import { useEffect, useRef, useState } from 'react'
import './PriorityDotPicker.css'

export function PriorityDotPicker({ options, onChange, priority }) {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function handleChange(nextPriority) {
    onChange(nextPriority)
    setOpen(false)
  }

  return (
    <div className="priority-dot-picker" ref={pickerRef}>
      <button
        aria-expanded={open}
        aria-label="修改重点标签"
        className={`priority-dot priority-dot--${priority}`}
        onClick={() => setOpen((value) => !value)}
        type="button"
      />
      {open ? (
        <div className="priority-dot-popover" aria-label="选择重点标签">
          {options.map((option) => (
            <button
              aria-label={option.label}
              className={`priority-dot priority-dot--${option.value}`}
              onClick={() => handleChange(option.value)}
              type="button"
              key={option.value}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
