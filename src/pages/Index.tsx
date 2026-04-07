import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, Bot, BarChart3, BookOpen, ArrowRight, Users, Brain, Shield, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const STATS = [
  { value: '10K+', label: 'Active Learners' },
  { value: '22', label: 'Matric Subjects' },
  { value: '95%', label: 'Pass Rate' },
  { value: '24/7', label: 'AI Tutor Access' },
];

const TESTIMONIALS = [
  { name: 'Thando M.', school: 'Johannesburg', quote: 'MatricMind helped me improve my Maths mark from 42% to 78%. The AI tutor explains things way better than my textbook.' },
  { name: 'Lerato K.', school: 'Cape Town', quote: "The adaptive quizzes found my weak spots in Physical Sciences. I'm now confident for finals." },
  { name: 'Mrs. Van der Merwe', school: 'Pretoria High', quote: 'As a teacher, the analytics dashboard saves me hours. I can see exactly which topics students struggle with.' },
];

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="gradient-hero min-h-screen flex flex-col">
        <header className="px-6 lg:px-12 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-secondary-foreground" />
            </div>
            <span className="text-xl font-display font-bold text-primary-foreground">MatricMind</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button className="gradient-gold text-secondary-foreground hover:opacity-90" onClick={() => navigate('/auth')}>
              Get Started
            </Button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="max-w-3xl text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 text-primary-foreground/80 text-sm mb-8">
              <Sparkle /> AI-Powered Learning for Matric Success
            </div>
            <h1 className="text-5xl lg:text-7xl font-display font-bold text-primary-foreground leading-tight mb-6">
              Your Personal
              <span className="block text-accent"> Matric Tutor</span>
            </h1>
            <p className="text-xl text-primary-foreground/70 mb-10 max-w-xl mx-auto">
              Get personalised help for every subject, AI-generated practice tests, and real-time progress tracking. Designed for South African Grade 12 learners.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button size="lg" className="gradient-gold text-secondary-foreground hover:opacity-90 text-base px-8" onClick={() => navigate('/auth')}>
                Start Learning Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Stats Bar */}
        <div className="border-t border-primary-foreground/10 px-6">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 py-8">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl lg:text-4xl font-display font-bold text-accent">{stat.value}</p>
                <p className="text-sm text-primary-foreground/60 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-center mb-4">
            Everything you need to <span className="text-accent">ace your matric</span>
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
            Built on the CAPS curriculum with AI that adapts to your learning pace and style.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Bot, title: 'AI Tutor Chat', desc: 'Ask questions in any subject and get explanations tailored to your learning style. Available 24/7.' },
              { icon: Brain, title: 'Adaptive Quizzes', desc: 'AI-generated tests that focus on your weak areas to maximise improvement.' },
              { icon: BarChart3, title: 'Progress Tracking', desc: 'See exactly where you stand in every subject with detailed mastery analytics.' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="glass-card group relative rounded-3xl p-8 text-center overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-3xl gradient-gold flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-primary/20 transition-all duration-300">
                    <feature.icon className="w-8 h-8 text-secondary-foreground" />
                  </div>
                  <h3 className="text-xl font-display font-bold mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.desc}</p>
                </div>
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* For Everyone */}
      <section className="py-24 px-6 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-center mb-16">
            Built for <span className="text-accent">every role</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { icon: BookOpen, title: 'Students', items: ['AI tutor for any subject', 'Adaptive quizzes & homework', 'Progress tracking per topic', 'Chat history & revision'] },
              { icon: Users, title: 'Teachers', items: ['Lesson plan management', 'Assignment creation', 'Student progress monitoring', 'Subject performance analytics'] },
              { icon: Shield, title: 'Head Teachers', items: ['School-wide analytics', 'Teacher oversight', 'Announcement system', 'Performance dashboards'] },
              { icon: BarChart3, title: 'Administrators', items: ['User management', 'System activity logs', 'Role assignments', 'Platform configuration'] },
            ].map((role, i) => (
              <motion.div
                key={role.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="glass-card rounded-2xl p-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
                    <role.icon className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <h3 className="text-xl font-display font-semibold">{role.title}</h3>
                </div>
                <ul className="space-y-2">
                  {role.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-center mb-16">
            What our users <span className="text-accent">say</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass-card rounded-2xl p-8"
              >
                <p className="text-foreground/80 italic mb-6">"{t.quote}"</p>
                <div>
                  <p className="font-display font-semibold">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.school}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="gradient-navy rounded-3xl p-12 lg:p-16"
          >
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-primary-foreground mb-4">
              Ready to ace your matric?
            </h2>
            <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto">
              Join thousands of South African learners using AI to study smarter, not harder.
            </p>
            <Button size="lg" className="gradient-gold text-secondary-foreground hover:opacity-90 text-base px-8" onClick={() => navigate('/auth')}>
              Get Started for Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="gradient-navy py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-secondary-foreground" />
            </div>
            <span className="font-display font-bold text-primary-foreground">MatricMind</span>
          </div>
          <p className="text-primary-foreground/50 text-sm">© 2026 MatricMind. Built for South African learners.</p>
        </div>
      </footer>
    </div>
  );
}

function Sparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
    </svg>
  );
}
