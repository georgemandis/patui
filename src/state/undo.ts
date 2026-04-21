import type { EditLayer } from "../core/edit-layer.js";

const MAX_UNDO = 50;

class UndoStack {
  private undoStack: EditLayer[] = [];
  private redoStack: EditLayer[] = [];

  push(layer: EditLayer) {
    this.undoStack.push(layer.clone());
    if (this.undoStack.length > MAX_UNDO) {
      this.undoStack.shift();
    }
    this.redoStack = []; // new action clears redo
  }

  undo(current: EditLayer): EditLayer | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(current.clone());
    return prev;
  }

  redo(current: EditLayer): EditLayer | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(current.clone());
    return next;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export const undoStack = new UndoStack();
