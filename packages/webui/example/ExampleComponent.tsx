// Example of how to use shared UI components
// This would typically be integrated into existing components

import React, { useState } from 'react';
import {
  Button,
  Input,
  Message,
  PermissionDrawer,
  Tooltip,
} from '@qwen-code/webui';

const ExampleComponent: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [showPermissionDrawer, setShowPermissionDrawer] = useState(false);

  const handleConfirmPermission = () => {
    console.log('Permissions confirmed');
    setShowPermissionDrawer(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Shared Components Demo</h2>

      {/* Example of using shared Button component */}
      <div className="mb-4">
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowPermissionDrawer(true)}
        >
          Show Permission Drawer
        </Button>
      </div>

      {/* Example of using shared Input component */}
      <div className="mb-4">
        <Input
          value={inputValue}
          onChange={setInputValue}
          placeholder="Type something..."
        />
      </div>

      {/* Example of using shared Message component */}
      <div className="mb-4">
        <Message
          id="demo-message"
          content="This is a shared message component"
          sender="system"
          timestamp={new Date()}
        />
      </div>

      {/* Example of using shared Tooltip component */}
      <div className="mb-4">
        <Tooltip content="This is a helpful tooltip" position="top">
          <Button variant="secondary">Hover for tooltip</Button>
        </Tooltip>
      </div>

      {/* Example of using shared PermissionDrawer component */}
      <PermissionDrawer
        isOpen={showPermissionDrawer}
        onClose={() => setShowPermissionDrawer(false)}
        onConfirm={handleConfirmPermission}
        permissions={[
          'Access browser history',
          'Read current page',
          'Capture screenshots',
        ]}
      />
    </div>
  );
};

export default ExampleComponent;
