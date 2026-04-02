// ============================================================
// Matric Mind AI - Enhanced Settings Page
// Settings with language, notification, voice, and offline preferences
// ============================================================

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ALL_SUBJECTS, SUBJECT_LABELS, normalizeSubject } from '@/lib/subjects';
import { toast } from 'sonner';
import {
  User, BookOpen, Save, LogOut, Globe, Bell, Volume2, Wifi,
  Languages, Mail, Smartphone, Moon, Headphones, Gauge,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';
import {
  SUPPORTED_VOICE_LANGUAGES,
  getVoicePreferences,
  saveVoicePreferences,
  type VoicePreferences,
} from '@/services/voice-additions';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function EnhancedSettingsPage() {
  const { user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Profile state
  const [fullName, setFullName] = useState('');
  const [subjects, setSubjects] = useState<MatricSubject[]>([]);

  // Language preferences
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [translateEnabled, setTranslateEnabled] = useState(false);

  // Notification preferences
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [quietHoursStart, setQuietHoursStart] = useState('');
  const [quietHoursEnd, setQuietHoursEnd] = useState('');
  const [channels, setChannels] = useState<string[]>([
    'announcements', 'quiz_results', 'streaks', 'study_reminders',
  ]);

  // Voice preferences
  const [voicePrefs, setVoicePrefs] = useState<VoicePreferences>({
    language: 'en',
    speechRate: 1.0,
    voicePitch: 0,
    autoPlay: true,
    conversationMode: false,
  });

  // Offline preferences
  const [autoSync, setAutoSync] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(false);

  const profileTable = role === 'teacher' ? 'teacher_profiles' : 'student_profiles';

  const { data: roleProfile } = useQuery<{ subjects?: MatricSubject[] } | null>({
    queryKey: [profileTable, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from(profileTable).select('*').eq('user_id', user!.id).single();
      return data as { subjects?: MatricSubject[] } | null;
    },
    enabled: !!user && (role === 'student' || role === 'teacher'),
  });

  // Load language preferences
  const { data: langPrefs } = useQuery({
    queryKey: ['language_preferences', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('language_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Load notification preferences
  const { data: notifPrefs } = useQuery({
    queryKey: ['notification_preferences', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Initialize state from loaded data
  useEffect(() => {
    if (profile) setFullName(profile.full_name);
    if (roleProfile?.subjects) {
      setSubjects(roleProfile.subjects.map(s => normalizeSubject(s)));
    }
  }, [profile, roleProfile]);

  useEffect(() => {
    if (langPrefs) {
      setPreferredLanguage(langPrefs.preferred_language || 'en');
      setTranslateEnabled(langPrefs.translate_enabled || false);
    }
  }, [langPrefs]);

  useEffect(() => {
    if (notifPrefs) {
      setPushEnabled(notifPrefs.push_enabled ?? true);
      setEmailEnabled(notifPrefs.email_enabled ?? true);
      setQuietHoursStart(notifPrefs.quiet_hours_start || '');
      setQuietHoursEnd(notifPrefs.quiet_hours_end || '');
      setChannels(notifPrefs.channels_json || ['announcements', 'quiz_results', 'streaks', 'study_reminders']);
    }
  }, [notifPrefs]);

  useEffect(() => {
    setVoicePrefs(getVoicePreferences());
  }, []);

  const toggleSubject = (subject: MatricSubject) => {
    setSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const toggleChannel = (channel: string) => {
    setChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  };

  // Save profile mutation
  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', user!.id);
      if (profileError) throw profileError;

      if ((role === 'student' || role === 'teacher') && roleProfile) {
        const { error: roleError } = await supabase
          .from(profileTable)
          .update({ subjects })
          .eq('user_id', user!.id);
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: [profileTable] });
      toast.success('Profile updated!');
    },
    onError: (e: unknown) => {
      const errorMessage = e instanceof Error ? e.message : 'Failed to update profile';
      toast.error(errorMessage);
    },
  });

  // Save language preferences
  const saveLanguagePrefs = async () => {
    if (!user?.id) return;
    await supabase
      .from('language_preferences')
      .upsert({
        user_id: user.id,
        preferred_language: preferredLanguage,
        translate_enabled: translateEnabled,
      });
    toast.success('Language preferences saved!');
  };

  // Save notification preferences
  const saveNotificationPrefs = async () => {
    if (!user?.id) return;
    await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        push_enabled: pushEnabled,
        email_enabled: emailEnabled,
        quiet_hours_start: quietHoursStart || null,
        quiet_hours_end: quietHoursEnd || null,
        channels_json: channels,
      });
    toast.success('Notification preferences saved!');
  };

  // Save voice preferences
  const saveVoicePrefsHandler = () => {
    saveVoicePreferences(voicePrefs);
    toast.success('Voice preferences saved!');
  };

  // Save offline preferences
  const saveOfflinePrefs = () => {
    localStorage.setItem('matric_mind_offline_prefs', JSON.stringify({ autoSync, wifiOnly }));
    toast.success('Offline preferences saved!');
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-1 hidden sm:block" /> Profile
            </TabsTrigger>
            <TabsTrigger value="language">
              <Globe className="w-4 h-4 mr-1 hidden sm:block" /> Language
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-1 hidden sm:block" /> Notify
            </TabsTrigger>
            <TabsTrigger value="voice">
              <Volume2 className="w-4 h-4 mr-1 hidden sm:block" /> Voice
            </TabsTrigger>
            <TabsTrigger value="offline">
              <Wifi className="w-4 h-4 mr-1 hidden sm:block" /> Offline
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" /> Profile
                </CardTitle>
                <CardDescription>Your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled className="opacity-60" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input value={role === 'head_teacher' ? 'Head Teacher' : (role || '').charAt(0).toUpperCase() + (role || '').slice(1)} disabled className="opacity-60" />
                </div>
              </CardContent>
            </Card>

            {(role === 'student' || role === 'teacher') && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" /> Subjects
                  </CardTitle>
                  <CardDescription>Select your {role === 'student' ? 'enrolled' : 'teaching'} subjects</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {ALL_SUBJECTS.map(subject => (
                      <label key={subject} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-2 rounded-lg">
                        <Checkbox
                          checked={subjects.includes(subject)}
                          onCheckedChange={() => toggleSubject(subject)}
                        />
                        <span className="truncate">{SUBJECT_LABELS[subject]}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} size="lg">
              <Save className="w-4 h-4 mr-2" />
              {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
            </Button>
          </TabsContent>

          {/* Language Tab */}
          <TabsContent value="language" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="w-5 h-5" /> Language Preferences
                </CardTitle>
                <CardDescription>Set your preferred language for the platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Preferred Language</Label>
                  <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_VOICE_LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-translate content</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically translate AI responses to your language
                    </p>
                  </div>
                  <Switch checked={translateEnabled} onCheckedChange={setTranslateEnabled} />
                </div>

                <Button onClick={saveLanguagePrefs} size="sm">
                  <Save className="w-4 h-4 mr-2" /> Save Language
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" /> Notification Preferences
                </CardTitle>
                <CardDescription>Control how and when you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <Label>Push Notifications</Label>
                  </div>
                  <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <Label>Email Notifications</Label>
                  </div>
                  <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Moon className="w-3 h-3" /> Quiet Hours Start
                    </Label>
                    <Input
                      type="time"
                      value={quietHoursStart}
                      onChange={e => setQuietHoursStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quiet Hours End</Label>
                    <Input
                      type="time"
                      value={quietHoursEnd}
                      onChange={e => setQuietHoursEnd(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Notification Channels</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['announcements', 'quiz_results', 'streaks', 'study_reminders'].map(channel => (
                      <label key={channel} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-2 rounded-lg">
                        <Checkbox
                          checked={channels.includes(channel)}
                          onCheckedChange={() => toggleChannel(channel)}
                        />
                        <span className="capitalize">{channel.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button onClick={saveNotificationPrefs} size="sm">
                  <Save className="w-4 h-4 mr-2" /> Save Notifications
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Voice Tab */}
          <TabsContent value="voice" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="w-5 h-5" /> Voice Preferences
                </CardTitle>
                <CardDescription>Customize text-to-speech and voice input settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Voice Language</Label>
                  <Select
                    value={voicePrefs.language}
                    onValueChange={(v) => setVoicePrefs(prev => ({ ...prev, language: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_VOICE_LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Speech Rate</Label>
                    <span className="text-sm text-muted-foreground">{voicePrefs.speechRate.toFixed(1)}x</span>
                  </div>
                  <Input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={voicePrefs.speechRate}
                    onChange={e => setVoicePrefs(prev => ({ ...prev, speechRate: parseFloat(e.target.value) }))}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Slow</span><span>Normal</span><span>Fast</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Voice Pitch</Label>
                    <span className="text-sm text-muted-foreground">{voicePrefs.voicePitch > 0 ? '+' : ''}{voicePrefs.voicePitch}</span>
                  </div>
                  <Input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={voicePrefs.voicePitch}
                    onChange={e => setVoicePrefs(prev => ({ ...prev, voicePitch: parseInt(e.target.value) }))}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Low</span><span>Normal</span><span>High</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Auto-play AI responses</Label>
                  <Switch
                    checked={voicePrefs.autoPlay}
                    onCheckedChange={(v) => setVoicePrefs(prev => ({ ...prev, autoPlay: v }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Conversation Mode</Label>
                    <p className="text-xs text-muted-foreground">Keep mic open between messages</p>
                  </div>
                  <Switch
                    checked={voicePrefs.conversationMode}
                    onCheckedChange={(v) => setVoicePrefs(prev => ({ ...prev, conversationMode: v }))}
                  />
                </div>

                <Button onClick={saveVoicePrefsHandler} size="sm">
                  <Save className="w-4 h-4 mr-2" /> Save Voice Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Offline Tab */}
          <TabsContent value="offline" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="w-5 h-5" /> Offline Preferences
                </CardTitle>
                <CardDescription>Configure offline sync behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-sync when online</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically sync queued actions when connection is restored
                    </p>
                  </div>
                  <Switch checked={autoSync} onCheckedChange={setAutoSync} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sync on Wi-Fi only</Label>
                    <p className="text-xs text-muted-foreground">
                      Only sync when connected to Wi-Fi to save mobile data
                    </p>
                  </div>
                  <Switch checked={wifiOnly} onCheckedChange={setWifiOnly} />
                </div>

                <Button onClick={saveOfflinePrefs} size="sm">
                  <Save className="w-4 h-4 mr-2" /> Save Offline Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator className="my-8" />

        {/* Sign Out Section */}
        <Card className="glass-card border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <LogOut className="w-5 h-5" /> Sign Out
            </CardTitle>
            <CardDescription>Sign out of your account on this device</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              size="lg"
              className="w-full"
              onClick={async () => {
                await signOut();
                navigate('/auth');
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
