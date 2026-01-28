#!/usr/bin/env python3
"""
Qwen Concurrent Runner - Execute multiple CLI tasks across different models concurrently.

This tool creates isolated git worktrees for each task/model combination and executes
the Qwen CLI in parallel with status tracking and output capture.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

from rich.console import Console
from rich.live import Live
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, TaskID
import aiofiles
import aiofiles.os


class RunStatus(Enum):
    """Execution status for a single run."""
    QUEUED = "queued"
    PREPARING = "preparing"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CLEANING = "cleaning"


@dataclass
class Task:
    """A task definition containing one or more prompts."""
    id: str
    name: str
    prompts: List[str]


@dataclass
class RunConfig:
    """Configuration for the concurrent execution."""
    tasks: List[Task]
    models: List[str]
    concurrency: int = 4
    yolo: bool = True
    source_repo: Path = field(default_factory=lambda: Path.cwd())
    worktree_base: Path = field(default_factory=lambda: Path.home() / ".qwen" / "worktrees")
    outputs_dir: Path = field(default_factory=lambda: Path("./outputs"))
    results_file: Path = field(default_factory=lambda: Path("./results.json"))
    branch: Optional[str] = None  # Git branch to checkout (uses default if not set)
    keep_worktree: bool = False  # If true, don't remove git worktree after run


@dataclass
class PromptResult:
    """Result of a single prompt execution."""
    prompt_index: int
    prompt_text: str
    stdout_file: str
    stderr_file: str
    exit_code: int
    status: str  # "succeeded" or "failed"


@dataclass
class RunRecord:
    """Record of a single task/model execution."""
    run_id: str
    task_id: str
    task_name: str
    model: str
    status: RunStatus
    worktree_path: Optional[str] = None
    output_dir: Optional[str] = None
    logs_dir: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    exit_code: Optional[int] = None
    error_message: Optional[str] = None
    prompt_results: List[PromptResult] = field(default_factory=list)
    diff_file: Optional[str] = None  # Path to git diff output
    session_log_file: Optional[str] = None  # Path to session log (chat recording)
    session_id: Optional[str] = None  # Session ID (UUID from chat recording)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "task_id": self.task_id,
            "task_name": self.task_name,
            "model": self.model,
            "status": self.status.value,
            "worktree_path": self.worktree_path,
            "output_dir": self.output_dir,
            "logs_dir": self.logs_dir,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "exit_code": self.exit_code,
            "error_message": self.error_message,
            "diff_file": self.diff_file,
            "session_log_file": self.session_log_file,
            "session_id": self.session_id,
            "prompt_results": [
                {
                    "prompt_index": r.prompt_index,
                    "prompt_text": r.prompt_text,
                    "stdout_file": r.stdout_file,
                    "stderr_file": r.stderr_file,
                    "exit_code": r.exit_code,
                    "status": r.status,
                }
                for r in self.prompt_results
            ],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> RunRecord:
        return cls(
            run_id=data["run_id"],
            task_id=data["task_id"],
            task_name=data["task_name"],
            model=data["model"],
            status=RunStatus(data["status"]),
            worktree_path=data.get("worktree_path"),
            output_dir=data.get("output_dir"),
            logs_dir=data.get("logs_dir"),
            started_at=data.get("started_at"),
            ended_at=data.get("ended_at"),
            exit_code=data.get("exit_code"),
            error_message=data.get("error_message"),
            diff_file=data.get("diff_file"),
            session_log_file=data.get("session_log_file"),
            session_id=data.get("session_id"),
        )


@dataclass
class ExecutionState:
    """Overall execution state across all runs."""
    runs: List[RunRecord] = field(default_factory=list)
    total: int = 0
    completed: int = 0
    succeeded: int = 0
    failed: int = 0


class GitWorktreeManager:
    """Manages git worktree creation, initialization, and cleanup."""

    def __init__(self, console: Console, source_repo: Path):
        self.console = console
        self.source_repo = source_repo

    async def ensure_git_repo(self) -> None:
        """Ensure the source repository is a valid git repo, initialize if not."""
        git_dir = self.source_repo / ".git"
        if git_dir.exists():
            return

        self.console.print(f"[yellow]Source repo is not a git repository. Initializing...[/yellow]")

        # git init
        result = await self._run_command(["git", "init"], cwd=self.source_repo)
        if result.returncode != 0:
            raise RuntimeError(f"Failed to initialize git repo: {result.stderr}")

        # git add .
        result = await self._run_command(["git", "add", "."], cwd=self.source_repo)
        if result.returncode != 0:
            raise RuntimeError(f"Failed to stage files: {result.stderr}")

        # git commit
        result = await self._run_command(
            ["git", "commit", "-m", "Initial commit"],
            cwd=self.source_repo
        )
        if result.returncode != 0:
            raise RuntimeError(f"Failed to create initial commit: {result.stderr}")

        self.console.print(f"[green]✓ Git repository initialized[/green]")

    async def create(self, source_repo: Path, worktree_dir: Path, branch: Optional[str] = None) -> Path:
        """Create a new git worktree from the source repository."""
        worktree_dir.parent.mkdir(parents=True, exist_ok=True)

        # Build worktree command
        if branch:
            # Create a unique branch for this worktree based on the specified branch
            worktree_branch = f"{branch}-{worktree_dir.name}"
            cmd = ["git", "worktree", "add", "-b", worktree_branch, str(worktree_dir), branch]
            self.console.print(f"[dim]Git: Creating worktree with branch '{worktree_branch}' from '{branch}'...[/dim]")
        else:
            # Create worktree from HEAD (default branch)
            cmd = ["git", "worktree", "add", str(worktree_dir)]

        self.console.print(f"[dim]Git: {' '.join(cmd)}[/dim]")
        result = await self._run_command(cmd, cwd=source_repo)

        if result.returncode != 0:
            raise RuntimeError(f"Failed to create worktree: {result.stderr}")

        return worktree_dir


    async def remove(self, worktree_dir: Path) -> None:
        """Remove a git worktree."""
        if not worktree_dir.exists():
            self.console.print(f"[dim]Worktree already removed: {worktree_dir}[/dim]")
            return

        self.console.print(f"[dim]Removing worktree: {worktree_dir}[/dim]")
        cmd = ["git", "worktree", "remove", "--force", str(worktree_dir)]
        result = await self._run_command(cmd, cwd=self.source_repo)

        if result.returncode != 0:
            self.console.print(f"[yellow]Warning: Failed to remove worktree {worktree_dir}: {result.stderr}[/yellow]")
            # Fallback to manual removal
            try:
                shutil.rmtree(worktree_dir, ignore_errors=True)
            except Exception:
                pass

    async def get_diff(self, worktree_dir: Path) -> str:
        """Get git diff showing all changes in the worktree."""
        self.console.print(f"[dim]Capturing git diff from {worktree_dir.name}...[/dim]")

        # First, stage all changes (including untracked files) so we can get a complete diff
        await self._run_command(["git", "add", "-A"], cwd=worktree_dir)

        # Get the diff (staged changes)
        result = await self._run_command(["git", "diff", "--cached", "--no-color"], cwd=worktree_dir)

        if result.returncode != 0:
            self.console.print(f"[yellow]Warning: Failed to get diff: {result.stderr}[/yellow]")
            return ""

        return result.stdout

    async def collect_session_log(self, worktree_dir: Path, output_dir: Path) -> Optional[Tuple[Path, str]]:
        """Collect the session log file from the worktree's chat recording.

        Session logs are stored at:
        ~/.qwen/projects/{projectId}/chats/{sessionId}.jsonl

        Where projectId is the sanitized worktree path.

        Returns:
            Tuple of (output_path, session_id) or None if not found.
        """
        import re

        # Compute projectId by sanitizing the worktree path (same as storage.ts)
        project_id = re.sub(r'[^a-zA-Z0-9]', '-', str(worktree_dir))

        # Build the chats directory path
        qwen_dir = Path.home() / ".qwen"
        chats_dir = qwen_dir / "projects" / project_id / "chats"

        if not chats_dir.exists():
            self.console.print(f"[dim]No chats directory found at {chats_dir}[/dim]")
            return None

        # Find all .jsonl files in the chats directory
        jsonl_files = list(chats_dir.glob("*.jsonl"))
        if not jsonl_files:
            self.console.print(f"[dim]No session log files found in {chats_dir}[/dim]")
            return None

        # Get the most recently modified file (the one just created)
        session_log = max(jsonl_files, key=lambda f: f.stat().st_mtime)

        # Extract session ID from filename (remove .jsonl extension)
        session_id = session_log.stem

        # Copy to output directory with original filename (preserves session ID)
        # Place in 'chats' subdir to match the actual session log structure
        chats_output_dir = output_dir / "chats"
        chats_output_dir.mkdir(parents=True, exist_ok=True)
        output_log = chats_output_dir / session_log.name

        # Read the original file, modify cwd field, and write to output
        # cwd should be the actual current working dir (where runner is executed)
        actual_cwd = str(Path.cwd())
        async with aiofiles.open(session_log, 'r') as src, aiofiles.open(output_log, 'w') as dst:
            async for line in src:
                line = line.strip()
                if line:
                    try:
                        record = json.loads(line)
                        record['cwd'] = actual_cwd
                        await dst.write(json.dumps(record, ensure_ascii=False) + '\n')
                    except json.JSONDecodeError:
                        # If line is not valid JSON, write it as-is
                        await dst.write(line + '\n')

        self.console.print(f"[dim]Session log copied: {session_log.name}[/dim]")

        return output_log, session_id

    async def _run_command(
        self,
        cmd: List[str],
        cwd: Optional[Path] = None,
        timeout: int = 60
    ) -> subprocess.CompletedProcess:
        """Run a command asynchronously."""
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), 
                timeout=timeout
            )
            return subprocess.CompletedProcess(
                args=cmd,
                returncode=proc.returncode,
                stdout=stdout.decode() if stdout else "",
                stderr=stderr.decode() if stderr else "",
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise RuntimeError(f"Command timed out after {timeout}s: {' '.join(cmd)}")


class StatusTracker:
    """Thread-safe status tracking with JSON persistence."""

    def __init__(self, results_file: Path, console: Console):
        self.results_file = results_file
        self.console = console
        self._lock = asyncio.Lock()
        self._runs: Dict[str, RunRecord] = {}

    async def initialize(self, runs: List[RunRecord]) -> None:
        """Initialize the tracker with all runs."""
        async with self._lock:
            for run in runs:
                self._runs[run.run_id] = run
            await self._persist()

    async def update_status(
        self, 
        run_id: str, 
        status: RunStatus,
        **kwargs
    ) -> None:
        """Update the status of a run."""
        async with self._lock:
            if run_id in self._runs:
                run = self._runs[run_id]
                run.status = status
                for key, value in kwargs.items():
                    if hasattr(run, key):
                        setattr(run, key, value)
                await self._persist()

    async def _persist(self) -> None:
        """Persist current state to JSON file."""
        data = {
            "updated_at": datetime.now().isoformat(),
            "runs": [run.to_dict() for run in self._runs.values()],
        }
        
        # Write atomically
        temp_file = self.results_file.with_suffix('.tmp')
        async with aiofiles.open(temp_file, 'w') as f:
            await f.write(json.dumps(data, indent=2))
        
        temp_file.replace(self.results_file)

    def get_state(self) -> ExecutionState:
        """Get current execution state."""
        runs = list(self._runs.values())
        completed = sum(1 for r in runs if r.status in (RunStatus.SUCCEEDED, RunStatus.FAILED))
        succeeded = sum(1 for r in runs if r.status == RunStatus.SUCCEEDED)
        failed = sum(1 for r in runs if r.status == RunStatus.FAILED)
        
        return ExecutionState(
            runs=runs,
            total=len(runs),
            completed=completed,
            succeeded=succeeded,
            failed=failed,
        )

    def get_active_runs(self) -> List[RunRecord]:
        """Get currently active runs."""
        active_statuses = {RunStatus.PREPARING, RunStatus.RUNNING}
        return [r for r in self._runs.values() if r.status in active_statuses]


class ProgressDisplay:
    """Rich-based progress display."""

    def __init__(self, console: Console):
        self.console = console
        self.live: Optional[Live] = None

    def start(self) -> None:
        """Start the live display."""
        self.live = Live(auto_refresh=True, console=self.console)
        self.live.start()

    def stop(self) -> None:
        """Stop the live display."""
        if self.live:
            self.live.stop()

    def update(self, state: ExecutionState) -> None:
        """Update the display with current state."""
        if not self.live:
            return

        # Summary panel
        summary = Table.grid(expand=True)
        summary.add_column()
        summary.add_column()
        summary.add_row(
            f"[bold]Total:[/bold] {state.total}",
            f"[bold]Completed:[/bold] {state.completed}/{state.total}"
        )
        summary.add_row(
            f"[green bold]Succeeded:[/green bold] {state.succeeded}",
            f"[red bold]Failed:[/red bold] {state.failed}"
        )

        # Active runs table
        active_runs = [r for r in state.runs if r.status not in (RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.QUEUED)]
        
        runs_table = Table(
            title="Active Runs",
            show_header=True,
            header_style="bold magenta",
            expand=True,
        )
        runs_table.add_column("Task", style="cyan")
        runs_table.add_column("Model", style="green")
        runs_table.add_column("Status", style="yellow")
        runs_table.add_column("Started", style="dim")

        for run in active_runs[:10]:  # Show up to 10 active runs
            started = run.started_at or "N/A"
            if len(started) > 19:
                started = started[11:19]  # Extract time portion
            runs_table.add_row(
                run.task_name[:30],
                run.model[:25],
                run.status.value,
                started,
            )

        # Recent completed runs
        completed_runs = sorted(
            [r for r in state.runs if r.status in (RunStatus.SUCCEEDED, RunStatus.FAILED)],
            key=lambda r: r.ended_at or "",
            reverse=True,
        )[:5]

        completed_table = Table(
            title="Recently Completed",
            show_header=True,
            header_style="bold blue",
            expand=True,
        )
        completed_table.add_column("Task", style="cyan")
        completed_table.add_column("Model", style="green")
        completed_table.add_column("Status", style="bold")
        completed_table.add_column("Duration", style="dim")

        for run in completed_runs:
            status_color = "green" if run.status == RunStatus.SUCCEEDED else "red"
            duration = "N/A"
            if run.started_at and run.ended_at:
                try:
                    start = datetime.fromisoformat(run.started_at)
                    end = datetime.fromisoformat(run.ended_at)
                    duration_sec = (end - start).total_seconds()
                    duration = f"{duration_sec:.1f}s"
                except:
                    pass
            
            completed_table.add_row(
                run.task_name[:30],
                run.model[:25],
                f"[{status_color}]{run.status.value}[/{status_color}]",
                duration,
            )

        # Combine everything
        layout = Table.grid(expand=True)
        layout.add_column()
        layout.add_row(Panel(summary, title="Execution Summary", border_style="blue"))
        layout.add_row(runs_table)
        if completed_runs:
            layout.add_row(completed_table)

        self.live.update(layout)

    def show_final_summary(self, state: ExecutionState) -> None:
        """Show final execution summary."""
        self.console.print()
        self.console.print(Panel(
            f"[bold green]Execution Complete![/bold green]\n\n"
            f"Total Runs: {state.total}\n"
            f"Succeeded: [green]{state.succeeded}[/green]\n"
            f"Failed: [red]{state.failed}[/red]\n"
            f"Success Rate: {(state.succeeded / state.total * 100):.1f}%",
            title="Final Results",
            border_style="green" if state.failed == 0 else "yellow",
        ))


class QwenRunner:
    """Executes the Qwen CLI for a specific task and model."""

    def __init__(self, config: RunConfig, console: Console):
        self.config = config
        self.console = console

    async def run(
        self,
        run: RunRecord,
        worktree_dir: Path,
        output_dir: Path,
    ) -> None:
        """Execute the Qwen CLI for each prompt sequentially."""
        output_dir.mkdir(parents=True, exist_ok=True)
        run.output_dir = str(output_dir)

        # Get the task and its prompts
        task = next((t for t in self.config.tasks if t.id == run.task_id), None)
        if not task or not task.prompts:
            raise ValueError(f"No prompts found for task {run.task_id}")

        # Setup logs directory
        run_logs_dir = (output_dir / "openai-logs").resolve()
        run_logs_dir.mkdir(parents=True, exist_ok=True)
        run.logs_dir = str(run_logs_dir)

        # Create outputs subdirectory for cleaner structure
        outputs_subdir = output_dir / "outputs"
        outputs_subdir.mkdir(parents=True, exist_ok=True)

        # Run each prompt sequentially
        for prompt_index, prompt_text in enumerate(task.prompts, start=1):
            self.console.print(f"[blue]Executing prompt {prompt_index}/{len(task.prompts)}...[/blue]")

            # Build command for this prompt
            cmd = self._build_command(run, prompt_text, prompt_index > 1)
            self.console.print(f"[dim]Command: {' '.join(cmd)}[/dim]")

            # Prepare output files for this prompt
            stdout_file = outputs_subdir / f"stdout-{prompt_index}.txt"
            stderr_file = outputs_subdir / f"stderr-{prompt_index}.txt"

            # Run the CLI
            env = os.environ.copy()
            env["QWEN_CODE_ROOT"] = str(worktree_dir)

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=worktree_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            # Capture output
            async def read_stream(stream, file_path):
                async with aiofiles.open(file_path, 'w') as f:
                    while True:
                        line = await stream.readline()
                        if not line:
                            break
                        decoded = line.decode()
                        await f.write(decoded)
                        await f.flush()

            await asyncio.gather(
                read_stream(proc.stdout, stdout_file),
                read_stream(proc.stderr, stderr_file),
            )

            returncode = await proc.wait()

            # Record result for this prompt
            prompt_result = PromptResult(
                prompt_index=prompt_index,
                prompt_text=prompt_text,
                stdout_file=str(stdout_file),
                stderr_file=str(stderr_file),
                exit_code=returncode,
                status="succeeded" if returncode == 0 else "failed",
            )
            run.prompt_results.append(prompt_result)

            # Stop on failure
            if returncode != 0:
                run.exit_code = returncode
                raise RuntimeError(f"Prompt {prompt_index} failed with exit code {returncode}")

        # All prompts succeeded
        run.exit_code = 0
        # Set legacy stdout/stderr files to first prompt's files for backwards compatibility
        if run.prompt_results:
            run.stdout_file = run.prompt_results[0].stdout_file
            run.stderr_file = run.prompt_results[0].stderr_file

    def _build_command(self, run: RunRecord, prompt_text: str, use_continue: bool = False) -> List[str]:
        """Build the qwen CLI command for a single prompt."""
        cmd = ["qwen"]

        # Add model
        cmd.extend(["--model", run.model])

        # Add yolo if enabled
        if self.config.yolo:
            cmd.append("--yolo")

        # Always enable OpenAI logging to run-specific logs directory
        cmd.append("--openai-logging")
        cmd.extend(["--openai-logging-dir", run.logs_dir])

        # Add --continue flag for follow-up prompts (to pick up chat history)
        if use_continue:
            cmd.append("--continue")

        # Add the prompt
        cmd.extend(["--prompt", prompt_text])

        return cmd


def generate_run_matrix(config: RunConfig) -> List[RunRecord]:
    """Generate all task × model combinations."""
    runs = []
    for task in config.tasks:
        for model in config.models:
            run_id = str(uuid.uuid4())[:8]
            runs.append(RunRecord(
                run_id=run_id,
                task_id=task.id,
                task_name=task.name,
                model=model,
                status=RunStatus.QUEUED,
            ))
    return runs


def load_config(config_path: Path) -> RunConfig:
    """Load configuration from JSON file."""
    with open(config_path, 'r') as f:
        data = json.load(f)
    
    tasks = [Task(**t) for t in data.get("tasks", [])]
    
    return RunConfig(
        tasks=tasks,
        models=data.get("models", []),
        concurrency=data.get("concurrency", 4),
        yolo=data.get("yolo", True),
        source_repo=Path(data.get("source_repo", ".")).resolve(),
        worktree_base=Path(data.get("worktree_base", "~/.qwen/worktrees")).expanduser(),
        outputs_dir=Path(data.get("outputs_dir", "./outputs")),
        results_file=Path(data.get("results_file", "./results.json")),
        branch=data.get("branch"),
    )


async def execute_single_run(
    run: RunRecord,
    config: RunConfig,
    tracker: StatusTracker,
    worktree_manager: GitWorktreeManager,
    qwen_runner: QwenRunner,
    console: Console,
) -> None:
    """Execute a single run with proper cleanup."""
    worktree_dir = None
    
    try:
        # Step 1: Create worktree
        await tracker.update_status(run.run_id, RunStatus.PREPARING)
        worktree_dir = config.worktree_base / f"run-{run.run_id}"
        await worktree_manager.create(config.source_repo, worktree_dir, config.branch)
        run.worktree_path = str(worktree_dir)
        run.started_at = datetime.now().isoformat()
        
        # Step 2: Run CLI
        await tracker.update_status(run.run_id, RunStatus.RUNNING)
        output_dir = config.outputs_dir / run.run_id
        await qwen_runner.run(run, worktree_dir, output_dir)
        
        # Step 3: Success
        run.ended_at = datetime.now().isoformat()
        await tracker.update_status(
            run.run_id, 
            RunStatus.SUCCEEDED,
            exit_code=run.exit_code,
            ended_at=run.ended_at,
        )
        console.print(f"[green]✓[/green] {run.task_name} / {run.model}")
        
    except Exception as e:
        run.ended_at = datetime.now().isoformat()
        await tracker.update_status(
            run.run_id,
            RunStatus.FAILED,
            error_message=str(e),
            ended_at=run.ended_at,
        )
        console.print(f"[red]✗[/red] {run.task_name} / {run.model}: {e}")

    finally:
        # Step 4: Capture git diff (before cleanup)
        output_dir = config.outputs_dir / run.run_id
        output_dir.mkdir(parents=True, exist_ok=True)

        if worktree_dir and worktree_dir.exists():
            try:
                diff_content = await worktree_manager.get_diff(worktree_dir)
                if diff_content.strip():
                    diff_file = output_dir / "diff.patch"
                    async with aiofiles.open(diff_file, 'w') as f:
                        await f.write(diff_content)
                    run.diff_file = str(diff_file)
                    console.print(f"[dim]Diff saved to {diff_file}[/dim]")
            except Exception as e:
                console.print(f"[yellow]Warning: Failed to capture diff: {e}[/yellow]")

        # Step 5: Collect session log (before cleanup)
        if worktree_dir:
            try:
                result = await worktree_manager.collect_session_log(worktree_dir, output_dir)
                if result:
                    session_log, session_id = result
                    run.session_log_file = str(session_log)
                    run.session_id = session_id
                    console.print(f"[dim]Session log saved: {session_log.name} (ID: {session_id})[/dim]")
            except Exception as e:
                console.print(f"[yellow]Warning: Failed to collect session log: {e}[/yellow]")

        # Update tracker with all captured files
        await tracker.update_status(
            run.run_id,
            run.status,
            diff_file=run.diff_file,
            session_log_file=run.session_log_file,
            session_id=run.session_id,
        )

        # Step 7: Cleanup
        if worktree_dir:
            if config.keep_worktree:
                console.print(f"[dim]Keeping worktree: {worktree_dir}[/dim]")
            else:
                await worktree_manager.remove(worktree_dir)


async def run_all(config: RunConfig, console: Console) -> ExecutionState:
    """Run all task/model combinations concurrently."""
    # Setup directories
    config.worktree_base.mkdir(parents=True, exist_ok=True)
    config.outputs_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate all runs
    runs = generate_run_matrix(config)
    console.print(f"[bold]Generated {len(runs)} runs:[/bold] {len(config.tasks)} tasks × {len(config.models)} models")
    
    # Initialize components
    tracker = StatusTracker(config.results_file, console)
    await tracker.initialize(runs)
    
    worktree_manager = GitWorktreeManager(console, config.source_repo)
    await worktree_manager.ensure_git_repo()
    qwen_runner = QwenRunner(config, console)
    display = ProgressDisplay(console)

    # Start progress display
    display.start()

    # Progress update task
    stop_event = asyncio.Event()

    async def update_progress():
        while not stop_event.is_set():
            state = tracker.get_state()
            display.update(state)
            if state.completed >= state.total:
                stop_event.set()
                break
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=0.5)
            except asyncio.TimeoutError:
                continue

    # Execute runs with semaphore-controlled concurrency
    semaphore = asyncio.Semaphore(config.concurrency)

    async def execute_with_limit(run: RunRecord):
        async with semaphore:
            await execute_single_run(
                run, config, tracker, worktree_manager, qwen_runner, console
            )

    # Run everything
    try:
        await asyncio.gather(
            update_progress(),
            asyncio.gather(*[execute_with_limit(r) for r in runs]),
        )
    finally:
        stop_event.set()
        display.stop()

    # Show final summary
    final_state = tracker.get_state()
    display.show_final_summary(final_state)
    
    return final_state


def main():
    parser = argparse.ArgumentParser(
        description="Qwen Concurrent Runner - Execute multiple CLI tasks across models"
    )
    parser.add_argument(
        "config",
        type=Path,
        help="Path to configuration JSON file",
    )
    parser.add_argument(
        "--version",
        action="version",
        version="%(prog)s 1.0.0",
    )
    
    args = parser.parse_args()
    
    if not args.config.exists():
        print(f"Error: Config file not found: {args.config}", file=sys.stderr)
        sys.exit(1)
    
    console = Console()
    config = load_config(args.config)
    
    try:
        final_state = asyncio.run(run_all(config, console))
        sys.exit(0 if final_state.failed == 0 else 1)
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        sys.exit(130)
    except Exception as e:
        console.print(f"\n[red]Fatal error: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
