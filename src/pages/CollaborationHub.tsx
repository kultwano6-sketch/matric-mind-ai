// ============================================================
// Matric Mind AI - Collaboration Hub Page
// Study groups, chat, and real-time collaboration features
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Users, Plus, Send, Hash, UserPlus, ArrowLeft,
  Crown, Shield, MessageCircle, BookOpen,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface StudyGroup {
  id: string;
  name: string;
  subject: string;
  description: string;
  invite_code: string;
  created_by: string;
  member_count: number;
  created_at: string;
}

interface GroupMember {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profiles?: { full_name: string; avatar_url: string | null };
}

interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string };
}

const SUBJECTS = [
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'physical_sciences', label: 'Physical Sciences' },
  { value: 'life_sciences', label: 'Life Sciences' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'business_studies', label: 'Business Studies' },
  { value: 'economics', label: 'Economics' },
  { value: 'english_home_language', label: 'English' },
  { value: 'history', label: 'History' },
  { value: 'geography', label: 'Geography' },
  { value: 'general', label: 'General' },
];

export default function CollaborationHub() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('browse');
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Create group state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSubject, setCreateSubject] = useState('general');
  const [createDescription, setCreateDescription] = useState('');

  // Join group state
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // Load groups
  useEffect(() => {
    loadGroups();
  }, [user?.id]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!selectedGroup) return;

    loadGroupData(selectedGroup.id);
    subscribeToMessages(selectedGroup.id);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [selectedGroup?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      // Fetch all public groups
      const { data: allGroups } = await supabase
        .from('study_groups')
        .select('*')
        .order('created_at', { ascending: false });

      setGroups(allGroups || []);

      // Fetch groups user is a member of
      if (user?.id) {
        const { data: memberships } = await supabase
          .from('study_group_members')
          .select('group_id, study_groups(*)')
          .eq('user_id', user.id);

        const userGroups = (memberships || [])
          .map((m: any) => m.study_groups)
          .filter(Boolean) as StudyGroup[];

        setMyGroups(userGroups);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupData = async (groupId: string) => {
    try {
      // Load members
      const { data: memberData } = await supabase
        .from('study_group_members')
        .select('id, user_id, role, joined_at')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      setMembers((memberData || []) as GroupMember[]);

      // Load messages
      const { data: messageData } = await supabase
        .from('group_messages')
        .select('id, group_id, user_id, content, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(50);

      setMessages((messageData || []) as GroupMessage[]);
    } catch (error) {
      console.error('Failed to load group data:', error);
    }
  };

  const subscribeToMessages = (groupId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const newMsg = payload.new as GroupMessage;
          setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedGroup || !user?.id) return;

    const content = newMessage.trim();
    setNewMessage('');

    try {
      await supabase.from('group_messages').insert({
        group_id: selectedGroup.id,
        user_id: user.id,
        content,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

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

      // Add creator as admin member
      await supabase.from('study_group_members').insert({
        group_id: newGroup.id,
        user_id: user.id,
        role: 'admin',
      });

      setShowCreateDialog(false);
      setCreateName('');
      setCreateDescription('');
      setCreateSubject('general');
      loadGroups();
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim() || !user?.id) return;
    setJoinError('');

    try {
      const { data: group } = await supabase
        .from('study_groups')
        .select('*')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .single();

      if (!group) {
        setJoinError('Invalid invite code');
        return;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('study_group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        setJoinError('You are already a member of this group');
        return;
      }

      await supabase.from('study_group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'member',
      });

      setShowJoinDialog(false);
      setJoinCode('');
      loadGroups();
    } catch (error) {
      setJoinError('Invalid invite code or group not found');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Group Detail View
  if (selectedGroup) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-[calc(100vh-4rem)]"
      >
        {/* Sidebar - Members */}
        <div className="w-64 border-r bg-card flex flex-col">
          <div className="p-4 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedGroup(null)}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <h2 className="font-semibold truncate">{selectedGroup.name}</h2>
            <Badge variant="secondary" className="mt-1 text-xs">
              {selectedGroup.subject.replace('_', ' ')}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Code: {selectedGroup.invite_code}
            </p>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Members ({members.length})
            </h3>
            <div className="space-y-2">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-2">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-xs">U</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {member.profiles?.full_name || 'Student'}
                    </p>
                  </div>
                  {member.role === 'admin' && (
                    <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {selectedGroup.description && (
            <div className="p-4 border-t">
              <p className="text-xs text-muted-foreground">{selectedGroup.description}</p>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b bg-card flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Group Chat</h2>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isOwn = msg.user_id === user?.id;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${isOwn ? 'order-2' : ''}`}>
                        {!isOwn && (
                          <p className="text-xs text-muted-foreground mb-1">
                            {msg.profiles?.full_name || 'Student'}
                          </p>
                        )}
                        <div className={`px-3 py-2 rounded-lg text-sm ${
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}>
                          {msg.content}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(msg.created_at).toLocaleTimeString('en-ZA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t bg-card">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Main Views (Browse/My Groups/Create)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 max-w-6xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Study Groups</h1>
          <p className="text-muted-foreground">Collaborate with peers and learn together</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowJoinDialog(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Join with Code
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="browse" className="flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5" />
            Browse Groups
          </TabsTrigger>
          <TabsTrigger value="my" className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            My Groups ({myGroups.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 animate-pulse" />
              Loading groups...
            </div>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2">No study groups yet</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  Create the first group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group, i) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.01 }}
                >
                  <Card
                    className="cursor-pointer hover:border-primary/50 transition-colors h-full"
                    onClick={() => setSelectedGroup(group)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {group.subject.replace('_', ' ')}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {group.description || 'No description'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {group.member_count || 1} members
                        </span>
                        <span className="text-xs">
                          {new Date(group.created_at).toLocaleDateString('en-ZA')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my">
          {myGroups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2">You haven't joined any groups yet</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => setActiveTab('browse')}>
                    Browse Groups
                  </Button>
                  <Button onClick={() => setShowJoinDialog(true)}>
                    Join with Code
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myGroups.map((group, i) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.01 }}
                >
                  <Card
                    className="cursor-pointer hover:border-primary/50 transition-colors h-full"
                    onClick={() => setSelectedGroup(group)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        <Badge className="bg-primary/10 text-primary">
                          {group.subject.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MessageCircle className="w-3.5 h-3.5" />
                        Click to open chat
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Study Group</DialogTitle>
            <DialogDescription>
              Set up a new study group and invite classmates with the invite code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g., Grade 12 Maths Study Group"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="group-subject">Subject</Label>
              <Select value={createSubject} onValueChange={setCreateSubject}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="group-desc">Description</Label>
              <Textarea
                id="group-desc"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="What will you study together?"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={!createName.trim()}>
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Group Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={(open) => {
        setShowJoinDialog(open);
        if (!open) setJoinError('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join a Study Group</DialogTitle>
            <DialogDescription>
              Enter the invite code shared by your group admin.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g., ABC123"
              className="mt-1"
              maxLength={8}
            />
            {joinError && (
              <p className="text-sm text-red-500 mt-2">{joinError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>Cancel</Button>
            <Button onClick={handleJoinGroup} disabled={!joinCode.trim()}>
              Join Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
