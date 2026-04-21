import type { EditLayer } from "../core/edit-layer.js";

const MAX_UNDO = 50;

export interface UndoSnapshot {
  editLayer: EditLayer;
  grayscale: boolean;
  palette: string | null;
  dither: boolean;
}

class UndoStack {
  private undoStack: UndoSnapshot[] = [];
  private redoStack: UndoSnapshot[] = [];

  push(snapshot: UndoSnapshot) {
    this.undoStack.push({
      editLayer: snapshot.editLayer.clone(),
      grayscale: snapshot.grayscale,
      palette: snapshot.palette,
      dither: snapshot.dither,
    });
    if (this.undoStack.length > MAX_UNDO) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(current: UndoSnapshot): UndoSnapshot | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push({
      editLayer: current.editLayer.clone(),
      grayscale: current.grayscale,
      palette: current.palette,
      dither: current.dither,
    });
    return prev;
  }

  redo(current: UndoSnapshot): UndoSnapshot | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push({
      editLayer: current.editLayer.clone(),
      grayscale: current.grayscale,
      palette: current.palette,
      dither: current.dither,
    });
    return next;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export const undoStack = new UndoStack();
