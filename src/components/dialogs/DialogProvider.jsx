/**
 * DialogProvider — promise-based dialogs, so any component can write:
 *
 *   const name = await dialogs.prompt({ title: 'Rename', initial: 'Foo' });
 *   if (await dialogs.confirm({ title: 'Delete?', danger: true })) …
 *   const folderId = await dialogs.chooseFolder({ title: 'Move to' });
 *   const result = await dialogs.editTags({ projects });
 *   const mode = await dialogs.choose({ title, options: [{ value, label }] });
 *
 * Each call resolves with the user's answer, or null/false when cancelled.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import TextPromptDialog from './TextPromptDialog.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import FolderPickerDialog from './FolderPickerDialog.jsx';
import TagEditorDialog from './TagEditorDialog.jsx';
import ChoiceDialog from './ChoiceDialog.jsx';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { kind, props, resolve }

  const open = useCallback(
    (kind, props) => new Promise((resolve) => setDialog({ kind, props, resolve })),
    [],
  );
  const close = useCallback(
    (value) => {
      setDialog((d) => {
        d?.resolve(value);
        return null;
      });
    },
    [],
  );

  const api = useMemo(
    () => ({
      prompt: (props) => open('prompt', props),
      confirm: (props) => open('confirm', props),
      chooseFolder: (props) => open('folder', props),
      editTags: (props) => open('tags', props),
      choose: (props) => open('choice', props),
    }),
    [open],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog?.kind === 'prompt' && <TextPromptDialog {...dialog.props} onClose={close} />}
      {dialog?.kind === 'confirm' && <ConfirmDialog {...dialog.props} onClose={close} />}
      {dialog?.kind === 'folder' && <FolderPickerDialog {...dialog.props} onClose={close} />}
      {dialog?.kind === 'tags' && <TagEditorDialog {...dialog.props} onClose={close} />}
      {dialog?.kind === 'choice' && <ChoiceDialog {...dialog.props} onClose={close} />}
    </DialogContext.Provider>
  );
}

export function useDialogs() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>');
  return ctx;
}
