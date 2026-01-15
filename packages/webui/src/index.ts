// Shared UI Components Export
// Export all shared components from this package

// Context
export {
  PlatformContext,
  PlatformProvider,
  usePlatform,
} from './context/PlatformContext';
export type {
  PlatformContextValue,
  PlatformProviderProps,
  PlatformType,
} from './context/PlatformContext';

// Layout components
export { default as Container } from './components/layout/Container';
export { default as Header } from './components/layout/Header';
export { default as Sidebar } from './components/layout/Sidebar';
export { default as Main } from './components/layout/Main';
export { default as Footer } from './components/layout/Footer';

// Message components
export { default as Message } from './components/messages/Message';
export { default as MessageInput } from './components/messages/MessageInput';
export { default as MessageList } from './components/messages/MessageList';

// UI Elements
export { default as Button } from './components/ui/Button';
export { default as Input } from './components/ui/Input';
export { default as Tooltip } from './components/ui/Tooltip';

// Permission components
export { default as PermissionDrawer } from './components/PermissionDrawer';

// Icons
export { default as Icon } from './components/icons/Icon';
export { default as CloseIcon } from './components/icons/CloseIcon';
export { default as SendIcon } from './components/icons/SendIcon';

// Hooks
export { useTheme } from './hooks/useTheme';
export { useLocalStorage } from './hooks/useLocalStorage';

// Types
export type { Theme } from './types/theme';
export type { MessageProps } from './types/messages';
export type { ChatMessage, MessageRole, PlanEntry } from './types/chat';
export type {
  ToolCallStatus,
  ToolCallLocation,
  ToolCallContentItem,
  ToolCallUpdate,
} from './types/toolCall';
