import { useState, useCallback } from "react";

interface DragDropHandlers {
  getDraggableProps: (id: string) => {
    draggable: true;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
  };
  getDropZoneProps: (zoneId: string) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

interface UseDragAndDropProps {
  onDrop: (draggedItemId: string, targetZoneId: string) => void;
}

export function useDragAndDrop({ onDrop }: UseDragAndDropProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  const getDraggableProps = useCallback((id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDraggedItem(id);
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
      
      // Add visual feedback
      const target = e.currentTarget as HTMLElement;
      target.style.opacity = "0.5";
    },
    onDragEnd: (e: React.DragEvent) => {
      setDraggedItem(null);
      
      // Remove visual feedback
      const target = e.currentTarget as HTMLElement;
      target.style.opacity = "1";
    },
  }), []);

  const getDropZoneProps = useCallback((zoneId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverZone(zoneId);
      
      // Add visual feedback
      const target = e.currentTarget as HTMLElement;
      target.classList.add("drag-over");
    },
    onDragLeave: (e: React.DragEvent) => {
      // Only remove drag-over if we're actually leaving the zone
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      
      if (
        x < rect.left ||
        x > rect.right ||
        y < rect.top ||
        y > rect.bottom
      ) {
        target.classList.remove("drag-over");
        setDragOverZone(null);
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId && draggedId !== zoneId) {
        onDrop(draggedId, zoneId);
      }
      
      // Clean up visual feedback
      const target = e.currentTarget as HTMLElement;
      target.classList.remove("drag-over");
      setDraggedItem(null);
      setDragOverZone(null);
    },
  }), [onDrop]);

  return {
    draggedItem,
    dragOverZone,
    dragHandlers: {
      getDraggableProps,
      getDropZoneProps,
    },
  };
}

/**
 * Higher-order component for making elements draggable
 */
export function withDragHandle<T extends { id: string; className?: string }>(
  Component: React.ComponentType<any>
) {
  return function DraggableComponent(props: T & { onDragStart?: (id: string) => void }) {
    const handleDragStart = (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", props.id);
      e.dataTransfer.effectAllowed = "move";
      props.onDragStart?.(props.id);
    };

    return (
      <Component
        {...props}
        draggable
        onDragStart={handleDragStart}
        className={`${props.className || ""} cursor-move`}
      />
    );
  };
}

/**
 * Higher-order component for making elements drop zones
 */
export function withDropZone<T extends { id: string; className?: string }>(
  Component: React.ComponentType<any>
) {
  return function DropZoneComponent(props: T & { 
    onDrop?: (draggedId: string, targetId: string) => void;
    onDragOver?: (draggedId: string, targetId: string) => void;
  }) {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      
      if (!isDragOver) {
        setIsDragOver(true);
        const draggedId = e.dataTransfer.getData("text/plain");
        props.onDragOver?.(draggedId, props.id);
      }
    };

    const handleDragLeave = (e: React.DragEvent) => {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      
      if (
        x < rect.left ||
        x > rect.right ||
        y < rect.top ||
        y > rect.bottom
      ) {
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId !== props.id) {
        props.onDrop?.(draggedId, props.id);
      }
    };

    return (
      <Component
        {...props}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`${props.className || ""} ${isDragOver ? 'drag-over' : ''}`}
      />
    );
  };
}
