import { useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Mark, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Link } from 'react-router'
import { Bold, Italic, List, Redo2, Underline as UnderlineIcon, Undo2 } from 'lucide-react'
import { SketchButton } from '../../../design-system/ui/SketchButton.jsx'
import { editorConfig } from '../editorConfig.js'
import './ReviewRichTextEditor.css'

const EMPTY_REVIEW_CONTENT = '<p></p>'

export function ReviewRichTextEditor({ initialContent, onContentChange, reviewId }) {
  const [tocItems, setTocItems] = useState([])
  const [selectedTocKey, setSelectedTocKey] = useState('')
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      ReviewHeadingMark,
      Underline,
      Placeholder.configure({
        placeholder: editorConfig.placeholder,
      }),
    ],
    content: initialContent || EMPTY_REVIEW_CONTENT,
    editorProps: {
      attributes: {
        class: 'review-rich-editor__surface',
      },
    },
    onCreate: ({ editor: currentEditor }) => {
      setTocItems(createTocItems(currentEditor))
      onContentChange?.(getEditorContentSnapshot(currentEditor), { initial: true })
    },
    onUpdate: ({ editor: currentEditor }) => {
      setTocItems(createTocItems(currentEditor))
      onContentChange?.(getEditorContentSnapshot(currentEditor), { initial: false })
    },
  })

  const normalizedTocItems = useMemo(() => tocItems, [tocItems])

  function handleTocClick(item) {
    if (!editor) return

    setSelectedTocKey(item.key)
    editor.chain().focus().setTextSelection(item.position).scrollIntoView().run()
    requestAnimationFrame(() => scrollEditorPositionIntoView(editor, item.position))
  }

  return (
    <section className="editor-shell review-editor-shell">
      <aside className="toc-panel">
        <h2>目录（{normalizedTocItems.length}）</h2>
        {normalizedTocItems.length > 0 ? (
          <nav className="toc-tree" aria-label="赛评目录">
            {normalizedTocItems.map((item, index) => (
              <button
                className={getTocItemClassName(item, index, selectedTocKey)}
                data-toc-level={item.level}
                onClick={() => handleTocClick(item)}
                type="button"
                key={item.key}
              >
                <span className="toc-tree-item__marker">{item.level === 1 ? '▾' : ''}</span>
                <span className="toc-tree-item__text">{item.text}</span>
              </button>
            ))}
          </nav>
        ) : (
          <p className="toc-empty">使用 H1 / H2 / H3 生成目录</p>
        )}
      </aside>

      <article className="editor-panel review-editor-panel">
        <nav className="editor-tabs">
          {['赛评内容', '评价与复盘', '相关资料', '训练记录'].map((tab, index) => (
            <button className={index === 0 ? 'tab tab--active handdrawn-underline handdrawn-underline--tab' : 'tab'} type="button" key={tab}>{tab}</button>
          ))}
        </nav>
        <EditorToolbar editor={editor} />
        <div className="review-editor-content-box">
          <EditorContent editor={editor} />
        </div>
      </article>

      <aside className="related-panel review-editor-related-panel">
        <h2>关联训练（2）</h2>
        {[1, 2].map((item) => (
          <div className="training-mini" key={item}>
            <strong>训练{item}</strong>
            <span>2026-06-04 12:2{item}</span>
            <p>{item === 1 ? '保留开头的判断句，...' : '下把结束压到20秒内...'}</p>
            <SketchButton as={Link} to="/trainings/training-001" variant="secondary">查看训练</SketchButton>
          </div>
        ))}
        <SketchButton as={Link} to={`/trainings/new?reviewId=${reviewId ?? 'review-001'}`} variant="secondary">＋ 关联更多训练</SketchButton>
      </aside>
    </section>
  )
}

function getEditorContentSnapshot(editor) {
  return {
    html: editor.getHTML(),
    text: editor.getText(),
  }
}

function EditorToolbar({ editor }) {
  if (!editor) return <div className="editor-toolbar" />

  const tools = [
    {
      active: editor.isActive('bold'),
      icon: <Bold size={17} />,
      label: '加粗',
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      active: editor.isActive('italic'),
      icon: <Italic size={17} />,
      label: '斜体',
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      active: editor.isActive('underline'),
      icon: <UnderlineIcon size={17} />,
      label: '下划线',
      onClick: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      active: editor.isActive('bulletList'),
      icon: <List size={17} />,
      label: '分点',
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      active: false,
      label: '正文',
      shortLabel: 'A',
      onClick: () => editor.chain().focus().unsetMark('reviewHeading').run(),
    },
    {
      active: editor.isActive('reviewHeading', { level: 1 }),
      label: 'H1',
      onClick: () => editor.chain().focus().toggleReviewHeading({ level: 1 }).run(),
    },
    {
      active: editor.isActive('reviewHeading', { level: 2 }),
      label: 'H2',
      onClick: () => editor.chain().focus().toggleReviewHeading({ level: 2 }).run(),
    },
    {
      active: editor.isActive('reviewHeading', { level: 3 }),
      label: 'H3',
      onClick: () => editor.chain().focus().toggleReviewHeading({ level: 3 }).run(),
    },
    {
      disabled: !editor.can().undo(),
      icon: <Undo2 size={17} />,
      label: '撤回',
      onClick: () => editor.chain().focus().undo().run(),
    },
    {
      disabled: !editor.can().redo(),
      icon: <Redo2 size={17} />,
      label: '反撤回',
      onClick: () => editor.chain().focus().redo().run(),
    },
  ]

  return (
    <div className="editor-toolbar review-editor-toolbar" aria-label="赛评编辑工具栏">
      {tools.map((tool) => (
        <button
          aria-label={tool.label}
          className={tool.active ? 'editor-tool editor-tool--active' : 'editor-tool'}
          disabled={tool.disabled}
          onClick={tool.onClick}
          title={tool.label}
          type="button"
          key={tool.label}
        >
          {tool.icon ?? tool.shortLabel ?? tool.label}
        </button>
      ))}
    </div>
  )
}

function getTocItemClassName(item, index, selectedTocKey) {
  const isActive = selectedTocKey ? item.key === selectedTocKey : index === 0
  return isActive ? 'toc-tree-item toc-tree-item--active' : 'toc-tree-item'
}

function scrollEditorPositionIntoView(editor, position) {
  const editorElement = editor.view.dom
  const scrollContainer = editorElement.closest('.review-editor-content-box')
  if (!scrollContainer) return

  const domAtPosition = editor.view.domAtPos(position)
  const targetElement = domAtPosition.node.nodeType === window.Node.TEXT_NODE
    ? domAtPosition.node.parentElement
    : domAtPosition.node
  if (!(targetElement instanceof window.Element)) return

  const containerRect = scrollContainer.getBoundingClientRect()
  const targetRect = targetElement.getBoundingClientRect()
  const targetOffset = targetRect.top - containerRect.top - scrollContainer.clientHeight * 0.25

  scrollContainer.scrollTo({
    behavior: 'smooth',
    top: scrollContainer.scrollTop + targetOffset,
  })
}

function createTocItems(editor) {
  const counters = [0, 0, 0]
  const headings = []

  editor.state.doc.descendants((node, position) => {
    if (!node.isTextblock) return true

    collectHeadingRuns(node, position).forEach((item) => {
      addTocItem(headings, counters, item.level, item.text, item.position)
    })

    return false
  })

  return headings
}

function collectHeadingRuns(node, blockPosition) {
  const runs = []
  let activeRun = null

  node.forEach((child, offset) => {
    const headingMark = child.marks?.find((mark) => mark.type.name === 'reviewHeading')

    if (!headingMark) {
      activeRun = null
      return
    }

    const level = Number(headingMark.attrs?.level ?? 1)
    if (!activeRun || activeRun.level !== level) {
      activeRun = { level, position: blockPosition + offset + 1, text: '' }
      runs.push(activeRun)
    }

    activeRun.text += child.text ?? ''
  })

  return runs
}

function addTocItem(headings, counters, level, text, position) {
  if (level < 1 || level > 3) return

  counters[level - 1] += 1
  for (let index = level; index < counters.length; index += 1) counters[index] = 0

  headings.push({
    key: `${position}-${level}-${headings.length}`,
    level,
    number: counters.slice(0, level).filter(Boolean).join('.'),
    position,
    text: text?.trim() || `未命名标题 ${headings.length + 1}`,
  })
}

const ReviewHeadingMark = Mark.create({
  name: 'reviewHeading',
  inclusive: true,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        requestAnimationFrame(() => {
          editor.chain().unsetMark(this.name).run()
        })

        return false
      },
    }
  },

  addAttributes() {
    return {
      level: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute('data-review-heading') ?? 1),
        renderHTML: (attributes) => ({
          'data-review-heading': attributes.level,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-review-heading]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const level = Number(HTMLAttributes.level ?? HTMLAttributes['data-review-heading'] ?? 1)

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: `review-heading-mark review-heading-mark--${level}`,
        'data-review-heading': level,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      toggleReviewHeading:
        (attributes) =>
          ({ commands, editor }) => (
            editor.isActive(this.name, attributes)
              ? commands.unsetMark(this.name)
              : commands.setMark(this.name, attributes)
          ),
    }
  },
})
