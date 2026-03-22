import { useState } from "react";

export default function StudyPlanner() {
  const [subjects] = useState([
      { name: "Math", exam: "2026-11-01", weakness: 80 },
          { name: "Physics", exam: "2026-11-10", weakness: 60 },
            ]);

              const plan = subjects.map((s) => {
                  const daysLeft = Math.max(
                        1,
                              (new Date(s.exam).getTime() - Date.now()) / 86400000
                                  );

                                      const dailyHours = Math.ceil(s.weakness / daysLeft);

                                          return {
                                                subject: s.name,
                                                      dailyHours,
                                                          };
                                                            });

                                                              return (
                                                                  <div style={{ padding: 20 }}>
                                                                        <h1>📅 Study Planner</h1>

                                                                              {plan.map((p, i) => (
                                                                                      <div key={i}>
                                                                                                {p.subject}: {p.dailyHours} hrs/day
                                                                                                        </div>
                                                                                                              ))}
                                                                                                                  </div>
                                                                                                                    );
                                                                                                                    }