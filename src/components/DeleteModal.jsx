import React, { useState } from 'react';
import './DeleteModal.css';

const DeleteModal = ({ isOpen, onClose, onConfirm, email }) => {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (confirmEmail !== email) return;
    
    setIsSubmitting(true);
    setError('');
    try {
      await onConfirm(confirmEmail);
      setConfirmEmail('');
    } catch (err) {
      setError(err?.message || 'Failed to delete account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setConfirmEmail('');
    onClose();
  };

  return (
    <div className="delete-modal-overlay">
      <div className="delete-modal">
        <div className="delete-modal-header">
          <h3>Delete Account</h3>
          <button 
            className="modal-close" 
            onClick={handleClose}
            disabled={isSubmitting}
          >
            &times;
          </button>
        </div>
        <div className="delete-modal-content">
          {error && <div className="delete-error">{error}</div>}
          <p className="warning-text">
            This will permanently delete your account and all associated data. 
            This action cannot be undone.
          </p>
          <p className="confirm-text">
            To confirm deletion, type your email address:
            <br />
            <span className="email-highlight">{email}</span>
          </p>
          <input 
            type="email" 
            className="confirm-email-input"
            placeholder="Enter your email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="delete-modal-actions">
          <button 
            className="cancel-delete-btn" 
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="confirm-delete-btn" 
            onClick={handleConfirm}
            disabled={confirmEmail !== email || isSubmitting}
          >
            {isSubmitting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;