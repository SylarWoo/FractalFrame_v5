import { OpenableSelect } from '../../controls/OpenableSelect'

export function DrawingOpenableSelectRow({
  className = '',
  label,
  onChange,
  options,
  value,
}: {
  className?: string
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <div className="ff-drawing-tline-tv-row-v1">
      <span className="ff-drawing-tline-tv-label-v1">{label}</span>
      <OpenableSelect
        ariaLabel={label}
        className={`ff-drawing-tline-tv-openable-select-v1 ${className}`.trim()}
        onChange={onChange}
        options={options}
        value={value}
      />
    </div>
  )
}
