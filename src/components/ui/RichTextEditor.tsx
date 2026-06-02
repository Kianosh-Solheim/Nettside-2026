import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Bold, Italic, Link2, Heading1, Heading2, List, Quote, Code, Image as ImageIcon, Maximize, Minimize } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onImageRequest?: () => Promise<{ url: string; alt?: string; credit?: string } | null>;
}

export default function RichTextEditor({ content, onChange, placeholder = 'Start writing...', onImageRequest }: RichTextEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Link.configure({
        openOnClick: false,
      }),
      Image,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg prose-p:text-ink prose-headings:text-ink prose-li:text-ink prose-strong:text-ink dark:prose-invert max-w-none focus:outline-none min-h-[400px] pb-32 w-full',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // Prevent cursor jump on typed changes by only setting content if it's external
      const currentHTML = editor.getHTML();
      if (content !== currentHTML && content !== '<p></p>') {
          // A bit hacky, but only set content if string length differs significantly or on first load.
          // Better: only set content if editor is pristine.
          // For simplicity we will only update if it's very different.
          // Wait, if it's controlled we should update, but tiptap handles its own state.
      }
    }
  }, [content, editor]);

  // Initial set content hack
  useEffect(() => {
    if (editor && content && !editor.isFocused) {
        if (editor.getHTML() !== content) {
          editor.commands.setContent(content);
        }
    }
  }, [content, editor]);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  if (!editor) {
    return null;
  }

  const addImage = async () => {
    if (onImageRequest) {
      const result = await onImageRequest();
      if (result && result.url) {
        if (result.credit) {
          editor.commands.insertContent([
            {
              type: 'image',
              attrs: { src: result.url, alt: result.alt, title: result.credit }
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: result.credit, marks: [{ type: 'italic' }] }]
            },
            {
              type: 'paragraph'
            }
          ]);
        } else {
          editor.chain().focus().setImage({ src: result.url }).run();
        }
      }
    } else {
      const url = window.prompt('URL');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const editorNode = (
    <div className={`relative w-full ${isFullscreen ? 'fixed inset-0 z-[100] bg-surface overflow-y-auto px-4 py-16 md:py-24' : 'transition-all duration-300'}`}>
      <div className={isFullscreen ? 'max-w-4xl mx-auto relative' : 'relative w-full'}>
        <button
          onClick={(e) => {
            e.preventDefault();
            setIsFullscreen(!isFullscreen);
          }}
          className={`absolute ${isFullscreen ? '-top-12 right-0' : 'top-2 right-2'} z-10 p-2 bg-surface border border-ink/10 rounded-xl text-ink/40 hover:text-ink shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest`}
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
        >
          {isFullscreen ? <><Minimize size={14} /> Close</> : <Maximize size={14} />}
        </button>

        {editor && (
          <BubbleMenu editor={editor} className="flex items-center bg-surface border border-ink/10 shadow-xl rounded-xl overflow-hidden p-1 gap-1">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-2 rounded-lg hover:bg-ink/5 transition-colors ${editor.isActive('bold') ? 'text-accent bg-accent/10' : 'text-ink/60'}`}
            >
              <Bold size={16} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-2 rounded-lg hover:bg-ink/5 transition-colors ${editor.isActive('italic') ? 'text-accent bg-accent/10' : 'text-ink/60'}`}
            >
              <Italic size={16} />
            </button>
            <button
              onClick={setLink}
              className={`p-2 rounded-lg hover:bg-ink/5 transition-colors ${editor.isActive('link') ? 'text-accent bg-accent/10' : 'text-ink/60'}`}
            >
              <Link2 size={16} />
            </button>
            <div className="w-px h-4 bg-ink/10 mx-1" />
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-2 rounded-lg hover:bg-ink/5 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'text-accent bg-accent/10' : 'text-ink/60'}`}
            >
              <Heading2 size={16} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-2 rounded-lg hover:bg-ink/5 transition-colors ${editor.isActive('blockquote') ? 'text-accent bg-accent/10' : 'text-ink/60'}`}
            >
              <Quote size={16} />
            </button>
          </BubbleMenu>
        )}

        {editor && (
          <FloatingMenu editor={editor} className="flex items-center gap-1">
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className="w-8 h-8 rounded-full bg-surface border border-ink/10 shadow-sm flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/5 transition-all text-xs font-serif"
              title="Heading 1"
            >
              H1
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className="w-8 h-8 rounded-full bg-surface border border-ink/10 shadow-sm flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/5 transition-all text-xs font-serif"
              title="Heading 2"
            >
              H2
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className="w-8 h-8 rounded-full bg-surface border border-ink/10 shadow-sm flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/5 transition-all"
              title="Bullet List"
            >
              <List size={14} />
            </button>
            <button
              onClick={addImage}
              className="w-8 h-8 rounded-full bg-surface border border-ink/10 shadow-sm flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/5 transition-all"
              title="Add Image"
            >
              <ImageIcon size={14} />
            </button>
          </FloatingMenu>
        )}

        <EditorContent editor={editor} className="cursor-text w-full" />
        
        <style dangerouslySetInnerHTML={{__html:`
          .is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: #adb5bd;
            pointer-events: none;
            height: 0;
          }
          .ProseMirror p.is-editor-empty:first-child::before {
            color: #adb5bd;
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
          .ProseMirror {
             outline: none !important;
          }
          .ProseMirror p {
             margin-top: 1em;
             margin-bottom: 1em;
             min-height: 1.5em; /* Ensures new lines map correctly visually */
          }
        `}} />
      </div>
    </div>
  );

  return isFullscreen && typeof document !== 'undefined'
    ? createPortal(editorNode, document.body)
    : editorNode;
}
