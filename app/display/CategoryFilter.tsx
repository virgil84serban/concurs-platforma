'use client'

type Props = {
  categories: string[]
  selectedCategory: string
  onChange: (value: string) => void
}

export default function CategoryFilter({
  categories,
  selectedCategory,
  onChange,
}: Props) {
  return (
    <select
      value={selectedCategory}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border px-3 py-2"
    >
      <option value="">Toate categoriile</option>

      {categories.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  )
}