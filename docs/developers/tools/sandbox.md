## Customizing the sandbox environment (Docker/Podman)

If you need extra tools inside the container (e.g., `git`, `python`, `rg`), create a custom Dockerfile:

1. `cd packages/cli`
2. `npm link`
3. `which qwen`
4. `cd your-project`

- Path: `.qwen/sandbox.Dockerfile`
- Then run with: `BUILD_SANDBOX=1 qwen -s ...`

This builds a project-specific image based on the default sandbox image.
