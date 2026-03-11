type UIFlags = {
  postDialogOpen: boolean;
  commentInputActive: boolean;
};

type UIFlagKey = 'postDialogOpen' | 'commentInputActive';

const counts: Record<UIFlagKey, number> = {
  postDialogOpen: 0,
  commentInputActive: 0,
};

const listeners = new Set<(flags: UIFlags) => void>();

const currentFlags = (): UIFlags => ({
  postDialogOpen: counts.postDialogOpen > 0,
  commentInputActive: counts.commentInputActive > 0,
});

const emit = () => {
  const flags = currentFlags();
  listeners.forEach((listener) => listener(flags));
};

const updateFlag = (key: UIFlagKey, active: boolean) => {
  const next = counts[key] + (active ? 1 : -1);
  counts[key] = Math.max(0, next);
  emit();
};

export const setPostDialogOpen = (open: boolean) => {
  updateFlag('postDialogOpen', open);
};

export const setCommentInputActive = (active: boolean) => {
  updateFlag('commentInputActive', active);
};

export const getUIFlags = () => currentFlags();

export const subscribeUIFlags = (listener: (flags: UIFlags) => void) => {
  listeners.add(listener);
  listener(currentFlags());
  return () => {
    listeners.delete(listener);
  };
};
