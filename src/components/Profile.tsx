import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, ImagePlus, Loader2, Save, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Profile({ profile }: any) {
  const [name, setName] = useState(profile.full_name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(profile.full_name || '')
    setBio(profile.bio || '')
    setAvatarUrl(profile.avatar_url || '')
  }, [profile.id, profile.full_name, profile.bio, profile.avatar_url])

  async function uploadAvatar(file: File) {
    setError('')
    setMessage('')

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photos must be 5 MB or smaller.')
      return
    }

    setUploading(true)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${profile.id}/${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${data.publicUrl}?v=${Date.now()}`
    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)

    if (updateError) setError(updateError.message)
    else {
      setAvatarUrl(url)
      setMessage('Profile photo updated.')
    }
    setUploading(false)
  }

  async function saveProfile() {
    setSaving(true)
    setError('')
    setMessage('')
    const { error: saveError } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), bio: bio.trim() })
      .eq('id', profile.id)

    if (saveError) setError(saveError.message)
    else setMessage('Profile saved successfully.')
    setSaving(false)
  }

  return (
    <div className="page profile-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">PROFILE</span>
          <h1>Your profile</h1>
          <p>Keep your profile photo and information up to date.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success"><CheckCircle2 size={15} />{message}</div>}

      <section className="panel profile-card-enhanced">
        <div className="profile-hero">
          <div className="avatar-editor">
            {avatarUrl ? (
              <img src={avatarUrl} alt={`${name || 'User'} profile`} className="profile-photo" />
            ) : (
              <div className="profile-photo profile-photo-placeholder"><UserRound size={42} /></div>
            )}
            <button
              className="avatar-camera"
              type="button"
              title="Change profile photo"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? <Loader2 size={15} className="spin" /> : <Camera size={15} />}
            </button>
            <input
              ref={fileRef}
              className="profile-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) uploadAvatar(file)
                e.currentTarget.value = ''
              }}
            />
          </div>
          <div className="profile-hero-copy">
            <span className="profile-role">{profile.role}</span>
            <h2>{name || 'Your name'}</h2>
            <p>{profile.email}</p>
            <button className="btn secondary small" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <ImagePlus size={14} />{uploading ? 'Uploading...' : 'Change photo'}
            </button>
            <small>JPG, PNG, WebP or GIF · Max 5 MB</small>
          </div>
        </div>

        <div className="profile-divider" />

        <div className="profile-form-enhanced">
          <label>
            Full name
            <input value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="Your full name" />
          </label>
          <label>
            Email
            <input value={profile.email || ''} disabled />
          </label>
          <label>
            Role
            <input value={profile.role || ''} disabled />
          </label>
          <label className="profile-bio-field">
            Bio
            <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} placeholder="Tell others a little about yourself..." />
            <small>{bio.length}/500</small>
          </label>
          <div className="profile-save-row">
            <button className="btn primary" type="button" onClick={saveProfile} disabled={saving || uploading || !name.trim()}>
              <Save size={15} />{saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
