import React, { useState } from 'react';
import EditingBanner from './EditingBanner';
import { compressImage } from '../utils/imageCompressor';
import { api, API_URL as SHARED_API_URL } from '../api/client';
import { Alert } from './ui';

export default function WeeklyForm({
  weeklyData,
  setWeeklyData,
  photosRequired = true,
  API_URL = SHARED_API_URL,
  editingDate,
  cancelEditing,
  onSubmit
}) {
  const [uploadingPose, setUploadingPose] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const photos = weeklyData.photos || { front: '', back: '', sideLeft: '', sideRight: '' };

  const handlePhotoSelect = async (pose, e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Select a valid image file (JPEG, PNG or WebP).');
      return;
    }

    setUploadingPose(pose);
    try {
      const dataUrl = await compressImage(file, 1600, 0.8);
      const targetDate = weeklyData.weekCommencing || editingDate || new Date().toISOString().split('T')[0];
      const data = await api.uploadPhoto({ date: targetDate, pose, dataUrl });
      setWeeklyData(prev => ({
        ...prev,
        photos: {
          ...(prev.photos || {}),
          [pose]: data.url
        }
      }));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingPose(null);
    }
  };

  const removePhoto = (pose) => {
    setWeeklyData(prev => ({
      ...prev,
      photos: {
        ...(prev.photos || {}),
        [pose]: ''
      }
    }));
  };

  const poses = [
    { key: 'front', label: '📸 Front Pose', subtitle: 'Facing forward, arms relaxed' },
    { key: 'back', label: '📸 Back Pose', subtitle: 'Facing away, arms relaxed' },
    { key: 'sideLeft', label: '📸 Left Side Pose', subtitle: 'Left side profile' },
    { key: 'sideRight', label: '📸 Right Side Pose', subtitle: 'Right side profile' }
  ];

  const uploadedCount = poses.filter(p => Boolean(photos[p.key])).length;
  const allPhotosUploaded = uploadedCount === poses.length;

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="section-title" style={{ marginBottom: '8px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          📅 Weekly Body Specs & Progress Photos
        </h2>
        <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
          Track physical progress, body circumferences, and progress photos. Required weekly to maintain device clearance.
        </p>
      </div>

      {uploadError && (
        <Alert variant="danger" title="Photo upload failed" onDismiss={() => setUploadError(null)}>
          {uploadError}
        </Alert>
      )}

      <EditingBanner editingDate={editingDate} cancelEditing={cancelEditing} />

      {/* Card 1: Baseline & Response Plan */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚖️ Weekly Baseline & Response Plan
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Record week commencing date, starting weight, and macro/training adjustment notes.</span>
        </div>

        <div className="form-grid-3">
          <div className="form-group">
            <label className="form-label">Week Commencing</label>
            <input type="date" className="form-input" required value={weeklyData.weekCommencing} onChange={(e) => setWeeklyData({...weeklyData, weekCommencing: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Start Weight (kg)</label>
            <input type="number" step="0.01" className="form-input" required placeholder="e.g. 79.2" value={weeklyData.startWeight} onChange={(e) => setWeeklyData({...weeklyData, startWeight: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Response Action / Notes</label>
            <input type="text" className="form-input" placeholder="Macro/cardio adjustments" value={weeklyData.responseAction} onChange={(e) => setWeeklyData({...weeklyData, responseAction: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Card 2: Circumference Specs */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            📐 Circumference Specs (cm)
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Measure key body landmarks to track hypertrophy and body composition shifts.</span>
        </div>

        <div className="form-grid-4" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">Umbilical (Waist)</label>
            <input type="number" step="0.1" className="form-input" required placeholder="e.g. 84.5" value={weeklyData.umbilical} onChange={(e) => setWeeklyData({...weeklyData, umbilical: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Bicep (Left)</label>
            <input type="number" step="0.1" className="form-input" required placeholder="e.g. 36.2" value={weeklyData.bicepL} onChange={(e) => setWeeklyData({...weeklyData, bicepL: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Bicep (Right)</label>
            <input type="number" step="0.1" className="form-input" required placeholder="e.g. 36.5" value={weeklyData.bicepR} onChange={(e) => setWeeklyData({...weeklyData, bicepR: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Chest</label>
            <input type="number" step="0.1" className="form-input" required placeholder="e.g. 102.4" value={weeklyData.chest} onChange={(e) => setWeeklyData({...weeklyData, chest: e.target.value})} />
          </div>
        </div>

        <div className="form-grid-3">
          <div className="form-group">
            <label className="form-label">Quad (Left)</label>
            <input type="number" step="0.1" className="form-input" required placeholder="e.g. 58.1" value={weeklyData.quadL} onChange={(e) => setWeeklyData({...weeklyData, quadL: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Quad (Right)</label>
            <input type="number" step="0.1" className="form-input" required placeholder="e.g. 58.3" value={weeklyData.quadR} onChange={(e) => setWeeklyData({...weeklyData, quadR: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Glutes</label>
            <input type="number" step="0.1" className="form-input" required placeholder="e.g. 98.2" value={weeklyData.glutes} onChange={(e) => setWeeklyData({...weeklyData, glutes: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Card 3: Required Progress Photos */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📷 Required Progress Photos
              {photosRequired && (
                <span style={{
                  fontSize: '0.75rem',
                  background: allPhotosUploaded ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: allPhotosUploaded ? '#4ade80' : '#f87171',
                  border: `1px solid ${allPhotosUploaded ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontWeight: 600
                }}>
                  {allPhotosUploaded ? '✓ Photos Completed' : `🔒 Blocker Required (${uploadedCount}/4)`}
                </span>
              )}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Upload Front, Back, Left Side, and Right Side progress photos.</span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px'
        }}>
          {poses.map((pose) => {
            const photoUrl = photos[pose.key];
            const fullUrl = photoUrl ? (photoUrl.startsWith('http') ? photoUrl : `${API_URL}${photoUrl}`) : '';

            return (
              <div
                key={pose.key}
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: `2px dashed ${photoUrl ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`,
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '180px'
                }}
              >
                {photoUrl ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img
                      src={fullUrl}
                      alt={pose.label}
                      style={{
                        width: '100%',
                        height: '140px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        marginBottom: '10px',
                        border: '1px solid var(--border-color)'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4ade80' }}>✓ {pose.label}</span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.75rem', color: '#f87171' }}
                        onClick={() => removePhoto(pose.key)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📸</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{pose.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{pose.subtitle}</div>
                    
                    <label
                      htmlFor={`photo-upload-${pose.key}`}
                      className="btn btn-secondary btn-sm"
                      style={{ cursor: 'pointer', display: 'inline-block' }}
                    >
                      {uploadingPose === pose.key ? 'Uploading...' : 'Choose Photo'}
                    </label>
                    <input
                      id={`photo-upload-${pose.key}`}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handlePhotoSelect(pose.key, e)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary btn-lg" style={{ padding: '14px 32px', fontSize: '1rem', fontWeight: 700 }}>
          🚀 Submit Weekly Specs
        </button>
      </div>
    </form>
  );
}
