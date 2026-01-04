# CLI and VSCode Extension Tool Display Name Unification Issue

## What would you like to be added?

This issue proposes unifying the tool display names between the CLI and VSCode Extension interfaces. Currently, the same tools show different names in different interfaces (e.g., `Shell Command`/`Shell` in CLI vs `Execute`/`Bash` in VSCode), creating confusion for users who switch between the two interfaces.

The proposal is to standardize the display names to use the core tool names (as defined in ToolDisplayNames constants) across both interfaces, making the user experience consistent regardless of which interface they use.

## Why is this needed?

1. **User Experience Consistency**: Users often switch between CLI and VSCode Extension, and seeing different names for the same tools creates confusion and cognitive overhead.

2. **Reduced Learning Curve**: Having consistent naming across interfaces means users only need to learn one set of tool names rather than interface-specific names.

3. **Professional Standards**: Consistent UI/UX design is a professional standard that improves user satisfaction and reduces support requests.

4. **Developer Productivity**: Consistent tool naming helps developers focus on their work rather than navigating interface differences.

## Overview

Currently, Qwen Code uses different display names for the same tools in the CLI and VSCode Extension, causing user experience inconsistency. This issue aims to unify the tool display names in both interfaces to provide a more consistent user experience.

## Current Tool Display Comparison

### 1. Shell Tool

- **Internal Name**: `run_shell_command`
- **CLI Display**: `Shell Command` or `Shell`
- **VSCode Display**: `Execute` or `Bash`

| CLI                                                                                   | VSCode Extension                                                  |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Shows as "Shell Command" when using shellCommandProcessor, "Shell" for LLM tool calls | Shows as "Execute" for execute kind, "Bash" for bash/command kind |

### 2. Edit Tool

- **Internal Name**: `edit`
- **CLI Display**: `Edit`
- **VSCode Display**: `Edit`

| CLI             | VSCode Extension                             |
| --------------- | -------------------------------------------- |
| Shows as "Edit" | Shows as "Edit" (via EditToolCall component) |

### 3. Write File Tool

- **Internal Name**: `write_file`
- **CLI Display**: `WriteFile`
- **VSCode Display**: `Write`

| CLI                  | VSCode Extension                               |
| -------------------- | ---------------------------------------------- |
| Shows as "WriteFile" | Shows as "Write" (via WriteToolCall component) |

### 4. Read File Tool

- **Internal Name**: `read_file`
- **CLI Display**: `ReadFile`
- **VSCode Display**: `Read`

| CLI                 | VSCode Extension                             |
| ------------------- | -------------------------------------------- |
| Shows as "ReadFile" | Shows as "Read" (via ReadToolCall component) |

### 5. Read Many Files Tool

- **Internal Name**: `read_many_files`
- **CLI Display**: `ReadManyFiles`
- **VSCode Display**: `Read`

| CLI                      | VSCode Extension                             |
| ------------------------ | -------------------------------------------- |
| Shows as "ReadManyFiles" | Shows as "Read" (via ReadToolCall component) |

### 6. Grep Search Tool

- **Internal Name**: `grep_search`
- **CLI Display**: `Grep`
- **VSCode Display**: `Search`

| CLI             | VSCode Extension                                 |
| --------------- | ------------------------------------------------ |
| Shows as "Grep" | Shows as "Search" (via SearchToolCall component) |

### 7. Glob Tool

- **Internal Name**: `glob`
- **CLI Display**: `Glob`
- **VSCode Display**: `Search`

| CLI             | VSCode Extension                                 |
| --------------- | ------------------------------------------------ |
| Shows as "Glob" | Shows as "Search" (via SearchToolCall component) |

### 8. List Directory Tool

- **Internal Name**: `list_directory`
- **CLI Display**: `ListFiles`
- **VSCode Display**: `Read`

| CLI                  | VSCode Extension                             |
| -------------------- | -------------------------------------------- |
| Shows as "ListFiles" | Shows as "Read" (via ReadToolCall component) |

### 9. Todo Write Tool

- **Internal Name**: `todo_write`
- **CLI Display**: `TodoWrite`
- **VSCode Display**: `Updated Plan`

| CLI                  | VSCode Extension                                            |
| -------------------- | ----------------------------------------------------------- |
| Shows as "TodoWrite" | Shows as "Updated Plan" (via UpdatedPlanToolCall component) |

### 10. Memory Tool

- **Internal Name**: `memory`
- **CLI Display**: `SaveMemory`
- **VSCode Display**: `Think`

| CLI                   | VSCode Extension                                  |
| --------------------- | ------------------------------------------------- |
| Shows as "SaveMemory" | Shows as "Thinking" (via ThinkToolCall component) |

### 11. Task Tool

- **Internal Name**: `task`
- **CLI Display**: `Task`
- **VSCode Display**: `Other` (via GenericToolCall)

| CLI             | VSCode Extension                                 |
| --------------- | ------------------------------------------------ |
| Shows as "Task" | Shows as generic component (via GenericToolCall) |

### 12. Skill Tool

- **Internal Name**: `skill`
- **CLI Display**: `Skill`
- **VSCode Display**: `Read`

| CLI              | VSCode Extension                             |
| ---------------- | -------------------------------------------- |
| Shows as "Skill" | Shows as "Read" (via ReadToolCall component) |

### 13. Exit Plan Mode Tool

- **Internal Name**: `exit_plan_mode`
- **CLI Display**: `ExitPlanMode`
- **VSCode Display**: `Think`

| CLI                     | VSCode Extension                                  |
| ----------------------- | ------------------------------------------------- |
| Shows as "ExitPlanMode" | Shows as "Thinking" (via ThinkToolCall component) |

### 14. Web Fetch Tool

- **Internal Name**: `web_fetch`
- **CLI Display**: `WebFetch`
- **VSCode Display**: `Fetch`

| CLI                 | VSCode Extension                                 |
| ------------------- | ------------------------------------------------ |
| Shows as "WebFetch" | Shows as "Fetch" (via GenericToolCall component) |

### 15. Web Search Tool

- **Internal Name**: `web_search`
- **CLI Display**: `WebSearch`
- **VSCode Display**: `Search`

| CLI                  | VSCode Extension                                 |
| -------------------- | ------------------------------------------------ |
| Shows as "WebSearch" | Shows as "Search" (via SearchToolCall component) |

## Unification Recommendations

Recommend unifying display names to the core tool display names (i.e., names from ToolDisplayNames):

1. **Shell tool**: Unify to `Shell` (from `Shell Command`/`Execute`/`Bash`)
2. **Todo Write tool**: Unify to `TodoWrite` (from `Updated Plan`)
3. **Memory/Exit Plan Mode tools**: Unify to `SaveMemory`/`ExitPlanMode` (from `Thinking`)
4. **Web Search tool**: Unify to `WebSearch` (from `Search`)
5. **Grep Search tool**: Unify to `Grep` (from `Search`)
6. **Glob tool**: Unify to `Glob` (from `Search`)
7. **List Directory tool**: Unify to `ListFiles` (from `Read`)
8. **Read File/Read Many Files tools**: Unify to `ReadFile`/`ReadManyFiles` (from `Read`)
9. **Write File tool**: Unify to `WriteFile` (from `Write`)
10. **Skill tool**: Unify to `Skill` (from `Read`)

## Technical Implementation Approach

The unification needs to focus on the VSCode IDE Companion side, as the CLI display names are already consistent with the core tool display names. The VSCode extension uses the `kind` property from ACP protocol to determine which component to display, and these components hardcode their labels.

### Key Files to Modify:

1. `packages/vscode-ide-companion/src/webview/components/messages/toolcalls/index.tsx`
   - Contains the `getToolCallComponent` function that maps `kind` to components

2. Individual component files in `packages/vscode-ide-companion/src/webview/components/messages/toolcalls/`:
   - `Execute/Execute.tsx` - Shows "Execute" label
   - `Bash/Bash.tsx` - Shows "Bash" label
   - `UpdatedPlan/UpdatedPlanToolCall.tsx` - Shows "Updated Plan" label
   - `Think/ThinkToolCall.tsx` - Shows "Thinking" label
   - `Search/SearchToolCall.tsx` - Shows "Search" label
   - `Read/ReadToolCall.tsx` - Shows "Read" label
   - `Write/WriteToolCall.tsx` - Shows "Write" label
   - `Edit/EditToolCall.tsx` - Shows "Edit" label
   - `GenericToolCall.tsx` - Fallback component

### Proposed Implementation:

1. **Option A - Modify component labels**: Change the hardcoded labels in each component to use the tool's display name from ToolDisplayNames
2. **Option B - Modify kind mapping**: Update the kind mapping to use more consistent values that align with core tool names
3. **Option C - Hybrid approach**: Use Option A for immediate consistency, then consider Option B for long-term improvement

### Recommended Approach: Option A (Component label modification)

This approach maintains the existing architecture while achieving the desired display name consistency:

1. Modify each tool call component to use the display name from the tool call's `title` property when available
2. Fallback to the tool's internal name or a consistent mapping from ToolDisplayNames
3. Maintain all existing functionality while standardizing display names

## Implementation Steps

1. **Research and mapping**: Create a complete mapping of all tools and their desired display names based on ToolDisplayNames constants
2. **Modify VSCode components**: Update component files to use consistent display names
3. **Test functionality**: Ensure all tool functionality remains intact after display name changes
4. **Update documentation**: Document the new unified display behavior
5. **Quality assurance**: Test in both CLI and VSCode Extension to ensure consistency

## Expected Outcome

The unified display names will provide a more consistent user experience, preventing confusion when users switch between CLI and VSCode Extension as the same tools will have identical names in both interfaces.
