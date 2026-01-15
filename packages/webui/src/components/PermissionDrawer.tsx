/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';

interface PermissionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  permissions: string[];
}

const PermissionDrawer: React.FC<PermissionDrawerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  permissions,
}) => {
  const [checkedPermissions, setCheckedPermissions] = useState<boolean[]>(
    Array(permissions.length).fill(false),
  );

  useEffect(() => {
    if (!isOpen) {
      setCheckedPermissions(Array(permissions.length).fill(false));
    }
  }, [isOpen, permissions]);

  const handleTogglePermission = (index: number) => {
    const newChecked = [...checkedPermissions];
    newChecked[index] = !newChecked[index];
    setCheckedPermissions(newChecked);
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-h-96 overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Permissions Required</h2>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <ul className="space-y-2">
            {permissions.map((permission, index) => (
              <li key={index} className="flex items-center">
                <input
                  type="checkbox"
                  checked={checkedPermissions[index]}
                  onChange={() => handleTogglePermission(index)}
                  className="mr-2 h-4 w-4"
                />
                <span>{permission}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 border-t flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!checkedPermissions.every((p) => p)}
            className={`px-4 py-2 rounded ${
              checkedPermissions.every((p) => p)
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionDrawer;
