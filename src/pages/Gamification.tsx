import { useState } from "react";

export default function Gamification() {
  const [xp, setXp] = useState(0);
    const [streak, setStreak] = useState(1);

      const complete = () => {
          setXp(xp + 50);
              setStreak(streak + 1);
                };

                  return (
                      <div>
                            <h1>Gamification</h1>
                                  <p>XP: {xp}</p>
                                        <p>🔥 Streak: {streak}</p>
                                              <button onClick={complete}>Complete Task</button>
                                                  </div>
                                                    );
                                                    }