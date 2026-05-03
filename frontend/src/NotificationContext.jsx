import React, { createContext, useContext, useState } from 'react';
import NotificationModal from './components/NotificationModal';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notif, setNotif] = useState({ isOpen: false, type: 'error', title: '', message: '' });

  const notify = (type, title, message) => {
    setNotif({ isOpen: true, type, title, message });
  };

  const error = (message, title = 'Error') => notify('error', title, message);
  const success = (message, title = 'Success') => notify('success', title, message);
  const info = (message, title = 'Info') => notify('info', title, message);

  const close = () => setNotif(prev => ({ ...prev, isOpen: false }));

  return (
    <NotificationContext.Provider value={{ error, success, info }}>
      {children}
      <NotificationModal 
        isOpen={notif.isOpen}
        onClose={close}
        type={notif.type}
        title={notif.title}
        message={notif.message}
      />
    </NotificationContext.Provider>
  );
};
