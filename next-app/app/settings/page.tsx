'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import { createClient } from '@/lib/supabase-client';
import { validateEmail, validatePassword } from '@/lib/auth-utils';

/**
 * User settings page
 * Allows users to update profile, email, password, username, and delete account
 * Follows Law of UX: Law of Common Region - grouped related settings
 */
export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => {
    if (typeof window !== 'undefined') {
      return createClient();
    }
    return null;
  }, []);

  // Profile state
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile picture upload state
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Email state
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  // Delete account state
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load user profile data from auth metadata
  useEffect(() => {
    if (!supabase) return;
    if (!user) {
      router.push('/');
      return;
    }

    // Load profile data from user metadata
    setDisplayName(user.user_metadata?.display_name || user.user_metadata?.name || '');
    setUsername(user.user_metadata?.username || '');
    setNewEmail(user.email || '');
    
    // Load profile picture URL from metadata or construct from storage
    const pictureUrl = user.user_metadata?.avatar_url;
    if (pictureUrl) {
      setProfilePictureUrl(pictureUrl);
    } else {
      // Try to get from storage (in case URL is not in metadata yet)
      const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(`${user.id}/avatar.png`);
      // Check if image exists by trying to load it
      fetch(data.publicUrl, { method: 'HEAD' })
        .then(res => {
          if (res.ok) {
            setProfilePictureUrl(data.publicUrl);
          }
        })
        .catch(() => {
          // Image doesn't exist, ignore
        });
    }
    
    setLoading(false);
  }, [user, router, supabase]);

  /**
   * Validates image file before upload
   * @param file - File to validate
   * @returns Validation error message or null if valid
   */
  const validateImage = (file: File): string | null => {
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return 'Invalid file type. Please use JPEG, PNG, WebP, or GIF.';
    }

    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return 'File size must be less than 5MB.';
    }

    return null;
  };

  /**
   * Validates image dimensions
   * @param file - Image file to validate
   * @param maxWidth - Maximum width in pixels
   * @param maxHeight - Maximum height in pixels
   * @returns Promise that resolves with validation error or null
   */
  const validateImageDimensions = async (
    file: File,
    maxWidth: number = 1024,
    maxHeight: number = 1024
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        if (img.width > maxWidth || img.height > maxHeight) {
          resolve(`Image dimensions must be at most ${maxWidth}x${maxHeight} pixels.`);
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve('Failed to load image for validation.');
      img.src = URL.createObjectURL(file);
    });
  };

  /**
   * Handles profile picture upload
   * @param e - File input change event
   */
  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!supabase) return;
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setPictureError(null);
    setUploadingPicture(true);

    try {
      // Validate file
      const validationError = validateImage(file);
      if (validationError) {
        setPictureError(validationError);
        setUploadingPicture(false);
        return;
      }

      // Validate dimensions
      const dimensionError = await validateImageDimensions(file, 1024, 1024);
      if (dimensionError) {
        setPictureError(dimensionError);
        setUploadingPicture(false);
        return;
      }

      // Create preview
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // Delete old image if exists (check common extensions)
      const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      const deletePromises = extensions.map(ext => 
        supabase.storage.from('profile-pictures').remove([`${user.id}/avatar.${ext}`])
      );
      await Promise.all(deletePromises);

      // Upload new image
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      // Update user metadata with avatar URL
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: urlData.publicUrl,
        },
      });

      if (updateError) throw updateError;

      setProfilePictureUrl(urlData.publicUrl);
      setPreviewUrl(null);
      
      // Clear file input
      e.target.value = '';
      
      alert('Profile picture updated successfully');
    } catch (err: any) {
      setPictureError(err.message || 'Failed to upload profile picture');
      setPreviewUrl(null);
    } finally {
      setUploadingPicture(false);
    }
  };

  /**
   * Handles profile picture deletion
   */
  const handleDeletePicture = async () => {
    if (!supabase || !user || !profilePictureUrl) return;

    if (!confirm('Are you sure you want to delete your profile picture?')) {
      return;
    }

    setUploadingPicture(true);
    setPictureError(null);

    try {
      // Delete from storage (check common extensions)
      const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      const deletePromises = extensions.map(ext => 
        supabase.storage.from('profile-pictures').remove([`${user.id}/avatar.${ext}`])
      );
      const results = await Promise.all(deletePromises);
      
      // Check if any deletion had an error (other than not found)
      const deleteError = results.find((result: any) => 
        result.error && result.error.message !== 'The resource was not found'
      )?.error;
      
      if (deleteError) {
        throw deleteError;
      }

      // Remove from user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: null,
        },
      });

      if (updateError) throw updateError;

      setProfilePictureUrl(null);
      alert('Profile picture deleted successfully');
    } catch (err: any) {
      setPictureError(err.message || 'Failed to delete profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  // Update profile (display name and username)
  const handleUpdateProfile = async (e: React.FormEvent) => {
    if (!supabase) return;
    e.preventDefault();
    setSaving(true);

    try {
      // Update user metadata in Supabase Auth
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          username: username,
        },
      });

      if (metadataError) throw metadataError;

      alert('Profile updated successfully');
      // Refresh the page to show updated data
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Update email
  const handleUpdateEmail = async (e: React.FormEvent) => {
    if (!supabase) return;
    e.preventDefault();
    setEmailError(null);
    setEmailMessage(null);

    if (!validateEmail(newEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (newEmail === user?.email) {
      setEmailError('New email must be different from current email');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) {
        setEmailError(error.message);
      } else {
        setEmailMessage('Please check your email to confirm the new email address');
      }
    } catch (err: any) {
      setEmailError(err.message || 'Failed to update email');
    } finally {
      setSaving(false);
    }
  };

  // Update password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    if (!supabase) return;
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordErrors([]);

    // Validate password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setPasswordErrors(passwordValidation.errors);
      setPasswordError('Please fix password requirements');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordMessage('Password updated successfully');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      // Delete user from auth
      // Note: This requires admin privileges, so we'll use the admin API via a route
      const response = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      // Sign out and redirect
      await signOut();
      router.push('/');
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-positive-highlight"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text mb-2">Settings</h1>
        <p className="text-text-secondary">Manage your account settings and preferences</p>
      </div>

      <div className="space-y-8">
        {/* Profile Settings */}
        <section className="bg-surface border border-divider rounded-lg p-6">
          <h2 className="text-xl font-semibold text-text mb-4">Profile Information</h2>
          
          {/* Profile Picture Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-text">
              Profile Picture
            </label>
            <div className="flex items-center gap-4">
              {/* Current/Preview Picture */}
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {(previewUrl || profilePictureUrl) && (
                  <img
                    src={previewUrl || profilePictureUrl || ''}
                    alt="Profile preview"
                    className="w-24 h-24 rounded-full object-cover border-2 border-divider"
                  />
                )}
                {!previewUrl && !profilePictureUrl && (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neon-cyan via-neon-magenta to-neon-teal flex items-center justify-center text-white font-semibold text-2xl border-2 border-divider">
                    {displayName.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    onChange={handlePictureUpload}
                    disabled={uploadingPicture}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-surface-variant border border-divider rounded text-text text-sm font-medium hover:bg-surface transition-colors inline-block disabled:opacity-50 cursor-pointer">
                    {uploadingPicture ? 'Uploading...' : profilePictureUrl ? 'Change Picture' : 'Upload Picture'}
                  </span>
                </label>
                
                {profilePictureUrl && (
                  <button
                    type="button"
                    onClick={handleDeletePicture}
                    disabled={uploadingPicture}
                    className="px-4 py-2 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    Remove Picture
                  </button>
                )}
              </div>
            </div>
            
            {pictureError && (
              <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {pictureError}
              </div>
            )}
            
            <p className="mt-2 text-xs text-text-secondary">
              Maximum file size: 5MB. Maximum dimensions: 1024x1024 pixels.
            </p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="display-name" className="block text-sm font-medium mb-2 text-text">
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2 text-text">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                placeholder="username"
              />
              <p className="mt-1 text-xs text-text-secondary">
                Only lowercase letters, numbers, and underscores allowed
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-positive-highlight text-black font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        {/* Email Settings */}
        <section className="bg-surface border border-divider rounded-lg p-6">
          <h2 className="text-xl font-semibold text-text mb-4">Email Address</h2>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            {emailError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {emailError}
              </div>
            )}
            {emailMessage && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-sm">
                {emailMessage}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-text">
                New Email Address
              </label>
              <input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                placeholder="your@email.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving || newEmail === user.email}
              className="px-4 py-2 bg-positive-highlight text-black font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update Email'}
            </button>
          </form>
        </section>

        {/* Password Settings */}
        <section className="bg-surface border border-divider rounded-lg p-6">
          <h2 className="text-xl font-semibold text-text mb-4">Password</h2>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {passwordError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {passwordError}
              </div>
            )}
            {passwordMessage && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-sm">
                {passwordMessage}
              </div>
            )}
            {passwordErrors.length > 0 && (
              <ul className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm list-disc list-inside">
                {passwordErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium mb-2 text-text">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium mb-2 text-text">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-positive-highlight text-black font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>

        {/* Delete Account */}
        <section className="bg-surface border border-red-500/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Delete Account</h2>
          <p className="text-text-secondary text-sm mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="delete-confirm" className="block text-sm font-medium mb-2 text-text">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm
                </label>
                <input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="w-full px-4 py-2 bg-surface-variant border border-red-500/30 rounded text-text focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="DELETE"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirm !== 'DELETE'}
                  className="px-4 py-2 bg-red-500 text-white font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Confirm Deletion'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirm('');
                  }}
                  disabled={deleting}
                  className="px-4 py-2 bg-surface-variant border border-divider rounded text-text hover:bg-surface transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

