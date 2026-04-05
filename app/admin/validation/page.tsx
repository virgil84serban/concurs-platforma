'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Performance = {
  id: string
  title: string
  admin_status: string | null
  music_file_path: string | null
  music_file_name: string | null
  clubs?: { name: string }
  categories?: {
    dance_style: string
    age_group: string
    formation_type: string
    level: string
  }
}

export default function AdminValidationPage() {
  const [data, setData] = useState<Performance[]>([])
  const [message, setMessage] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  async function loadData() {
    const { data, error } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        admin_status,
        music_file_path,
        music_file_name,
        clubs(name),
        categories(dance_style, age_group, formation_type, level)
      `)
      .eq('status', 'submitted')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      return
    }

    setData(data || [])
  }

  useEffect(() => {
    loadData()
  }, [])

  async function getSignedUrl(path: string) {
    const { data, error } = await supabase.storage
      .from('music')
      .createSignedUrl(path, 60)

    if (error) throw error
    return data.signedUrl
  }

  async function handlePreview(item: Performance) {
    if (!item.music_file_path) return

    const url = await getSignedUrl(item.music_file_path)
    setPreviewUrl(url)
    setActiveId(item.id)
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from('performances')
      .update({ admin_status: status })
      .eq('id', id)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Status actualizat')
    loadData()
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Validare momente</h1>

      {data.map((item) => (
        <div key={item.id} className="border rounded-xl p-4 space-y-3">
          <div>
            <p className="font-semibold">{item.title}</p>
            <p className="text-sm text-gray-500">
              {item.clubs?.name} | {item.categories?.dance_style} | {item.categories?.age_group}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handlePreview(item)}
              className="border px-3 py-1 rounded"
            >
              Asculta
            </button>

            <button
              onClick={() => updateStatus(item.id, 'approved')}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              Aproba
            </button>

            <button
              onClick={() => updateStatus(item.id, 'rejected')}
              className="bg-red-600 text-white px-3 py-1 rounded"
            >
              Respinge
            </button>
          </div>

          {activeId === item.id && previewUrl && (
            <audio controls src={previewUrl} className="w-full" />
          )}

          <div className="text-sm">
            Status: {item.admin_status || 'in asteptare'}
          </div>
        </div>
      ))}
    </main>
  )
}