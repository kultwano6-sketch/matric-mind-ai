// Motivation Card - Shows rotating inspirational quotes
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

// Unique motivational quotes for students (50+ unique)
const QUOTES = [
  { text: "Every expert was once a beginner. Keep going!", author: "Motric Mind" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Unknown" },
  { text: "Your limit is not the mountain, it's your mind.", author: "Unknown" },
  { text: "Winners never quit and quitters never win.", author: "Vince Lombardi" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "Dream big and dare to fail.", author: "Norman Vaughan" },
  { text: "Success is not how high you have climbed, but how you make a positive difference.", author: "Roy T. Bennett" },
  { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Focus on progress, not perfection.", author: "Unknown" },
  { text: "Your education is a dress rehearsal for a performance that never ends.", author: "Tom Bodett" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "Strive for progress, not perfection.", author: "Unknown" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Learning is not attained by chance, it must be sought for with order.", author: "Abigail Adams" },
  { text: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.", author: "Dr. Seuss" },
  { text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", author: "Malcolm X" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Knowledge is power. Information is liberating. Education is the premise of progress.", author: "Kofi Annan" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "Anyone who has never made a mistake has never tried anything new.", author: "Albert Einstein" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
  { text: "You are never too old to set another goal or to dream a new dream.", author: "C.S. Lewis" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", author: "Zig Ziglar" },
  { text: "In learning you will teach, and in teaching you will learn.", author: "Phil Collins" },
  { text: "Success isn't about how much money you make. It's about the difference you make in people's lives.", author: "Michelle Obama" },
  { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
  { text: "Be the change that you wish to see in the world.", author: "Mahatma Gandhi" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
  { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
  { text: "Don't be distracted by criticism. Remember, the only taste of success some people get is to take a bite out of you.", author: "Zig Ziglar" },
  { text: "The difference between ordinary and extraordinary is practice.", author: "Vladimir Horowitz" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
  { text: "Keep your face always toward the sunshine—and shadows will fall behind you.", author: "Walt Whitman" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Great things never come from comfort zones.", author: "Unknown" },
  { text: "Dream it. Wish it. Do it.", author: "Unknown" },
  { text: "Success doesn't just find you. You have to go out and get it.", author: "Unknown" },
  { text: "The harder you work, the luckier you get.", author: "Gary Player" },
];

// Hash function to get consistent index based on time
function getQuoteIndex(): number {
  const now = new Date();
  const hourOfYear = now.getMonth() * 744 + now.getDate() * 24 + now.getHours(); // hours since Jan 1
  return hourOfYear % QUOTES.length;
}

export default function MotivationCard() {
  const [quoteIndex, setQuoteIndex] = useState(getQuoteIndex);
  const [isVisible, setIsVisible] = useState(true);

  // Update every hour
  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        const newIndex = (quoteIndex + 1) % QUOTES.length;
        setQuoteIndex(newIndex);
        setIsVisible(true);
      }, 500);
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, [quoteIndex]);

  const quote = QUOTES[quoteIndex];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-orange-500/10 border-2 border-amber-500/20 p-5">
      <div className="absolute top-3 right-3">
        <Sparkles className="w-5 h-5 text-amber-500" />
      </div>
      
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={quoteIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-lg font-medium text-foreground italic leading-relaxed">
              "{quote.text}"
            </p>
            <p className="text-sm text-muted-foreground mt-3 text-right">
              — {quote.author}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground/50">
        Refreshes hourly
      </div>
    </div>
  );
}
