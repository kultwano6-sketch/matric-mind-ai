import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, Bot, BarChart3, BookOpen, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

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
      </div>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-center mb-16">
            Everything you need to <span className="text-accent">ace your matric</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Bot, title: 'AI Tutor Chat', desc: 'Ask questions in any subject and get explanations tailored to your learning style.' },
              { icon: BookOpen, title: 'Smart Assignments', desc: 'AI-generated homework and tests that adapt to your weak areas.' },
              { icon: BarChart3, title: 'Progress Tracking', desc: 'See exactly where you stand in every subject with detailed analytics.' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass-card rounded-2xl p-8 text-center"
              >
                <div className="w-14 h-14 rounded-2xl gradient-gold flex items-center justify-center mx-auto mb-5">
                  <feature.icon className="w-7 h-7 text-secondary-foreground" />
                </div>
                <h3 className="text-xl font-display font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
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
