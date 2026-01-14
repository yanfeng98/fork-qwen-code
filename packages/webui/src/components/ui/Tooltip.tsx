import React, { useState } from 'react';

interface ChildProps {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  tabIndex?: number;
}

interface TooltipProps {
  children: React.ReactElement<ChildProps>;
  content: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    right: 'top-1/2 left-full transform -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'top-1/2 right-full transform -translate-y-1/2 mr-2',
  };

  const arrowPositionClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 -mt-1',
    right: 'top-1/2 left-0 transform -translate-y-1/2 -ml-1',
    bottom: 'top-0 left-1/2 transform -translate-x-1/2 -mb-1',
    left: 'top-1/2 right-0 transform -translate-y-1/2 -mr-1',
  };

  const tooltipClass = `absolute ${positionClasses[position]} bg-gray-800 text-white text-xs rounded py-1 px-2 pointer-events-none z-10`;
  const arrowClass = `absolute w-2 h-2 bg-gray-800 transform rotate-45 ${arrowPositionClasses[position]}`;

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        tabIndex={0}
      >
        {React.cloneElement(children, {
          onMouseEnter: () => {
            setIsVisible(true);
            const typedChildren = children as React.ReactElement<ChildProps>;
            if (typeof typedChildren.props.onMouseEnter === 'function') {
              typedChildren.props.onMouseEnter();
            }
          },
          onMouseLeave: () => {
            setIsVisible(false);
            const typedChildren = children as React.ReactElement<ChildProps>;
            if (typeof typedChildren.props.onMouseLeave === 'function') {
              typedChildren.props.onMouseLeave();
            }
          },
          onFocus: () => {
            setIsVisible(true);
            const typedChildren = children as React.ReactElement<ChildProps>;
            if (typeof typedChildren.props.onFocus === 'function') {
              typedChildren.props.onFocus();
            }
          },
          onBlur: () => {
            setIsVisible(false);
            const typedChildren = children as React.ReactElement<ChildProps>;
            if (typeof typedChildren.props.onBlur === 'function') {
              typedChildren.props.onBlur();
            }
          },
          tabIndex:
            (children as React.ReactElement<ChildProps>).props.tabIndex || 0,
        })}
      </div>
      {isVisible && (
        <div className={tooltipClass}>
          {content}
          <div className={arrowClass}></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
