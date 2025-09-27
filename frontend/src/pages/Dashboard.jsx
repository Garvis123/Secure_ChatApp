import { useState } from 'react';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import { useChat } from '../context/ChatContext';

const Dashboard = () => {
  const { activeRoom } = useChat();

  return (
    <div className="h-screen flex flex-col bg-gradient-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ChatWindow roomId={activeRoom} />
      </div>
    </div>
  );
};

export default Dashboard;