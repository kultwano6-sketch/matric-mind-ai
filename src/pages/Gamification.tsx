import { useEffect, useState } from "react";

export default function Gamification() {
  const [xp, setXp] = useState(0);
    const [streak, setStreak] = useState(1);

      // Load saved data on start
        useEffect(() => {
            const savedXP = localStorage.getItem("xp");
                const savedStreak = localStorage.getItem("streak");

                    if (savedXP) setXp(Number(savedXP));
                        if (savedStreak) setStreak(Number(savedStreak));
                          }, []);

                            // Save XP whenever it changes
                              useEffect(() => {
                                  localStorage.setItem("xp", xp.toString());
                                    }, [xp]);

                                      // Save streak whenever it changes
                                        useEffect(() => {
                                            localStorage.setItem("streak", streak.toString());
                                              }, [streak]);

                                                const completeTask = () => {
                                                    setXp((prev) => prev + 50);
                                                        setStreak((prev) => prev + 1);
                                                          };

                                                            return (
                                                                <div style={{ padding: 20 }}>
                                                                      <h1>🎮 Gamification</h1>

                                                                            <p>XP: {xp}</p>
                                                                                  <p>🔥 Streak: {streak}</p>

                                                                                        <button onClick={completeTask}>
                                                                                                Complete Study Session
                                                                                                      </button>
                                                                                                          </div>
                                                                                                            );
                                                                                                            }