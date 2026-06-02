import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import { Bold, Italic, Link2, Heading1, Heading2, List, Quote, Code, Image as ImageIcon, Maximize, Minimize } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

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
      CharacterCount,
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

  const containerRef = useRef<HTMLDivElement>(null);

  // Handle fullscreen Native API
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error(err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error(err);
      });
    }
  };

  if (!editor) {
    return null;
  }

  const addImage = async () => {
    if (onImageRequest) {
      const result = await onImageRequest();
      if (result && result.url) {
        if (result.credit) {
          editor.commands.insertContent(`
            <img src="${result.url}" alt="${result.alt || ''}">
            <p style="text-align: center;"><em>${result.credit}</em></p>
            <p></p>
          `);
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
    <div ref={containerRef} className={`relative w-full bg-surface ${isFullscreen ? 'overflow-y-auto px-4 py-16 md:py-24' : 'transition-all duration-300'}`}>
      <div className={isFullscreen ? 'max-w-4xl mx-auto relative h-full' : 'relative w-full h-full'}>
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleFullscreen();
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
        
        <div className={`pt-4 border-t border-ink/5 flex items-center justify-between text-[10px] uppercase tracking-widest text-ink/40 font-black ${isFullscreen ? 'fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-sm p-4 z-50 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]' : 'mt-8'}`}>
          <div className={isFullscreen ? 'max-w-4xl mx-auto w-full flex items-center justify-between' : 'flex items-center justify-between w-full'}>
            <div>
              {editor.storage.characterCount.words()} words
            </div>
            <div>
              {editor.storage.characterCount.characters()} characters
            </div>
          </div>
        </div>

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

  return editorNode;
}
