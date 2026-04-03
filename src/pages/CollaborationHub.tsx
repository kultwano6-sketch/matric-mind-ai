// ============================================================
// Matric Mind AI - Collaboration Hub Page
// Video/voice calls, file sharing, voice notes, group chat
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Users, Plus, X, Video, Phone, Paperclip, Mic, 
  Send, Image, File, Film, Headphones, MicOff, 
  VideoOff, PhoneOff, Upload, FileText, Music,
  MessageSquare, Clock, Check, CheckCheck, Play, StopCircle
} from 'lucide-react';

interface StudyGroup {
  id: string;
  name: string;
  subject: string;
  description: string;
  invite_code: string;
  created_by: string;
  is_public: boolean;
  member_count?: number;
  created_at: string;
}

interface GroupMember {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
}

interface ChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  message_type: 'text' | 'file' | 'voice' | 'video' | 'image';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  duration_sec?: number;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
}

interface CallSession {
  id: string;
  group_id: string;
  initiated_by: string;
  call_type: 'video' | 'voice';
  status: 'active' | 'ended';
  started_at: string;
  ended_at?: string;
}

export default function CollaborationHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Groups state
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Call state
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState<'video' | 'voice'>('video');
  const [callParticipants, setCallParticipants] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSubject, setCreateSubject] = useState('general');
  const [createDescription, setCreateDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Load groups
  const loadGroups = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      
      // Load public groups
      const { data: publicGroups } = await supabase
        .from('study_groups')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Add member counts
      const groupsWithCounts = await Promise.all((publicGroups || []).map(async (group) => {
        const { count } = await supabase
          .from('study_group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);
        return { ...group, member_count: count || 0 };
      }));
      
      setGroups(groupsWithCounts as StudyGroup[]);
      
      // Load user's groups
      const { data: memberships } = await supabase
        .from('study_group_members')
        .select('*, study_groups(*)')
        .eq('user_id', user.id);
      
      const userGroups = (memberships || [])
        .map((m: any) => m.study_groups)
        .filter(Boolean) as StudyGroup[];
      
      setMyGroups(userGroups);
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load messages for selected group
  const loadMessages = useCallback(async (groupId: string) => {
    try {
      const { data } = await supabase
        .from('study_group_messages')
        .select('*, profiles(full_name, avatar_url)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(100);
      
      setMessages((data || []) as ChatMessage[]);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, []);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedGroup || !user?.id) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from('study_group_messages')
        .insert({
          group_id: selectedGroup.id,
          user_id: user.id,
          content: newMessage.trim(),
          message_type: 'text',
        });
      
      if (error) throw error;
      setNewMessage('');
      await loadMessages(selectedGroup.id);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  // Create group
  const handleCreateGroup = async () => {
    if (!createName.trim() || !user?.id) return;
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: newGroup, error } = await supabase
        .from('study_groups')
        .insert({
          name: createName.trim(),
          subject: createSubject,
          description: createDescription.trim(),
          invite_code: inviteCode,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add creator as admin
      await supabase.from('study_group_members').insert({
        group_id: newGroup.id,
        user_id: user.id,
        role: 'admin',
      });
      
      setShowCreateDialog(false);
      setCreateName('');
      setCreateDescription('');
      toast({ title: 'Group Created', description: `Invite code: ${inviteCode}` });
      await loadGroups();
      setSelectedGroup(newGroup);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Join group
  const handleJoinGroup = async () => {
    if (!joinCode.trim() || !user?.id) return;
    try {
      const { data: group } = await supabase
        .from('study_groups')
        .select('id')
        .eq('invite_code', joinCode.toUpperCase())
        .single();
      
      if (!group) throw new Error('Invalid invite code');
      
      // Check if already a member
      const { data: existing } = await supabase
        .from('study_group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .single();
      
      if (existing) throw new Error('Already a member');
      
      await supabase.from('study_group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'member',
      });
      
      setShowJoinDialog(false);
      setJoinCode('');
      toast({ title: 'Joined Group', description: 'You are now a member!' });
      await loadGroups();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedGroup || !user?.id) return;
    
    setUploading(true);
    try {
      // Upload to storage
      const filePath = `${selectedGroup.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('group-files')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('group-files')
        .getPublicUrl(filePath);
      
      // Determine message type
      let messageType: 'file' | 'image' | 'video' | 'voice' = 'file';
      if (file.type.startsWith('image/')) messageType = 'image';
      else if (file.type.startsWith('video/')) messageType = 'video';
      else if (file.type.startsWith('audio/')) messageType = 'voice';
      
      // Save message
      await supabase.from('study_group_messages').insert({
        group_id: selectedGroup.id,
        user_id: user.id,
        content: file.name,
        message_type: messageType,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
      });
      
      await loadMessages(selectedGroup.id);
      toast({ title: 'File Shared', description: `${file.name} uploaded successfully` });
    } catch (error: any) {
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Voice recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await uploadVoiceNote(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setRecording(true);
      
      // Stop after 60 seconds max
      setTimeout(() => {
        if (recording) stopVoiceRecording();
      }, 60000);
    } catch (error) {
      toast({ title: 'Error', description: 'Could not access microphone', variant: 'destructive' });
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const uploadVoiceNote = async (blob: Blob) => {
    if (!selectedGroup || !user?.id) return;
    setUploading(true);
    
    try {
      const filePath = `${selectedGroup.id}/voice_${Date.now()}.webm`;
      const { data: uploadData, error } = await supabase.storage
        .from('group-files')
        .upload(filePath, blob);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('group-files')
        .getPublicUrl(filePath);
      
      await supabase.from('study_group_messages').insert({
        group_id: selectedGroup.id,
        user_id: user.id,
        content: 'Voice note',
        message_type: 'voice',
        file_url: publicUrl,
      });
      
      await loadMessages(selectedGroup.id);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to upload voice note', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // Start call
  const startCall = async (type: 'video' | 'voice') => {
    if (!selectedGroup || !user?.id) return;
    setCallType(type);
    setInCall(true);
    setCallParticipants([user.id]);
    
    // TODO: Implement WebRTC signaling
    // For now, just show the call UI
    toast({ title: 'Call Started', description: `Starting ${type} call...` });
  };

  // End call
  const endCall = () => {
    setInCall(false);
    setCallParticipants([]);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  // Select group
  const selectGroup = (group: StudyGroup) => {
    setSelectedGroup(group);
    loadMessages(group.id);
  };

  // Initial load
  useEffect(() => {
    if (user?.id) {
      loadGroups();
    }
  }, [user, loadGroups]);

  // Subscribe to messages
  useEffect(() => {
    if (!selectedGroup?.id) return;
    
    const channel = supabase
      .channel(`group-${selectedGroup.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'study_group_messages',
        filter: `group_id=eq.${selectedGroup.id}`,
      }, (payload) => {
        loadMessages(selectedGroup.id);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGroup, loadMessages]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex">
        {/* Groups Sidebar */}
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold mb-3">Study Groups</h2>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateDialog(true)} className="flex-1">
                <Plus className="w-4 h-4 mr-1" /> Create
              </Button>
              <Button variant="outline" onClick={() => setShowJoinDialog(true)}>
                Join
              </Button>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2">
              {myGroups.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-muted-foreground px-2 mb-2">My Groups</h3>
                  {myGroups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => selectGroup(group)}
                      className={`w-full p-2 rounded-lg text-left mb-1 ${
                        selectedGroup?.id === group.id ? 'bg-primary/10' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium">{group.name}</div>
                      <div className="text-xs text-muted-foreground">{group.subject}</div>
                    </button>
                  ))}
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground px-2 mb-2">Discover</h3>
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => selectGroup(group)}
                    className={`w-full p-2 rounded-lg text-left mb-1 ${
                      selectedGroup?.id === group.id ? 'bg-primary/10' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium">{group.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.member_count || 0} members • {group.subject}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedGroup ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-bold">{selectedGroup.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedGroup.subject}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => startCall('voice')}>
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => startCall('video')}>
                    <Video className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Call UI */}
              <AnimatePresence>
                {inCall && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-b bg-primary/5 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {callType === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                        <span>In call with {callParticipants.length} participant(s)</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => setIsMuted(!isMuted)}>
                          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </Button>
                        {callType === 'video' && (
                          <Button variant="outline" size="icon" onClick={() => setIsVideoOff(!isVideoOff)}>
                            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                          </Button>
                        )}
                        <Button variant="destructive" size="icon" onClick={endCall}>
                          <PhoneOff className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.user_id === user?.id ? 'flex-row-reverse' : ''}`}>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={msg.profiles?.avatar_url} />
                        <AvatarFallback>{msg.profiles?.full_name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[70%] ${msg.user_id === user?.id ? 'text-right' : ''}`}>
                        <div className="text-xs text-muted-foreground mb-1">
                          {msg.profiles?.full_name || 'Unknown'}
                        </div>
                        
                        {msg.message_type === 'text' && (
                          <div className="p-3 rounded-lg bg-muted">
                            {msg.content}
                          </div>
                        )}
                        
                        {msg.message_type === 'image' && (
                          <div className="rounded-lg overflow-hidden">
                            <img src={msg.file_url} alt={msg.file_name} className="max-w-64" />
                          </div>
                        )}
                        
                        {msg.message_type === 'video' && (
                          <div className="rounded-lg overflow-hidden">
                            <video src={msg.file_url} controls className="max-w-64" />
                          </div>
                        )}
                        
                        {msg.message_type === 'voice' && (
                          <div className="p-3 rounded-lg bg-muted flex items-center gap-2">
                            <Button size="icon" variant="ghost" className="w-8 h-8">
                              <Play className="w-4 h-4" />
                            </Button>
                            <div className="flex-1 h-2 bg-primary/20 rounded-full">
                              <div className="w-1/2 h-full bg-primary rounded-full" />
                            </div>
                          </div>
                        )}
                        
                        {msg.message_type === 'file' && (
                          <a 
                            href={msg.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-3 rounded-lg bg-muted flex items-center gap-2 hover:bg-muted/80"
                          >
                            <File className="w-4 h-4" />
                            <div>
                              <div className="text-sm">{msg.file_name}</div>
                              {msg.file_size && (
                                <div className="text-xs text-muted-foreground">
                                  {formatFileSize(msg.file_size)}
                                </div>
                              )}
                            </div>
                          </a>
                        )}
                        
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2 items-end">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  />
                  <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={recording ? stopVoiceRecording : startVoiceRecording} disabled={uploading}>
                    {recording ? <StopCircle className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                {uploading && (
                  <div className="text-sm text-muted-foreground mt-2">
                    Uploading... {uploadProgress}%
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a group to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Study Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Group Name</label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Math Study Group" />
            </div>
            <div>
              <label className="text-sm font-medium">Subject</label>
              <select 
                value={createSubject} 
                onChange={(e) => setCreateSubject(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="general">General</option>
                <option value="mathematics">Mathematics</option>
                <option value="physical_sciences">Physical Sciences</option>
                <option value="life_sciences">Life Sciences</option>
                <option value="accounting">Accounting</option>
                <option value="geography">Geography</option>
                <option value="history">History</option>
                <option value="english">English</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="What's this group about?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={!createName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Group Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Study Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Invite Code</label>
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>Cancel</Button>
            <Button onClick={handleJoinGroup} disabled={!joinCode.trim()}>Join</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
      </Dialog>
    </DashboardLayout>
  );
}
