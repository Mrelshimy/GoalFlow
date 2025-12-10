
import { Achievement, Goal, Milestone, AchievementType, Task } from "../types";

// Helper to call OUR backend, not Google directly
const callAIProxy = async (payload: any) => {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("AI Service Error:", error);
    throw error;
  }
};

export const generateSmartGoal = async (rawText: string): Promise<string> => {
  try {
    const data = await callAIProxy({
      model: 'gemini-2.5-flash',
      contents: `Rewrite the following goal to be SMART (Specific, Measurable, Achievable, Relevant, Time-bound). 
      Return only the rewritten goal description text, no explanations.
      
      Original Goal: "${rawText}"`,
    });
    return data.text?.trim() || rawText;
  } catch (error) {
    return rawText;
  }
};

export const generateMilestones = async (goalText: string, timeframe: string): Promise<Omit<Milestone, 'id' | 'goalId'>[]> => {
  try {
    // Note: Type definition for Schema needs to be handled on backend or passed as simple JSON object if using proxy
    // We send the config to the proxy
    const data = await callAIProxy({
      model: 'gemini-2.5-flash',
      contents: `Generate 3 to 5 key milestones for the goal: "${goalText}" which needs to be completed by ${timeframe}. 
      Ensure deadlines are spaced out logically.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    description: { type: "STRING" },
                    status: { type: "STRING", enum: ['pending'] },
                    dueDate: { type: "STRING", description: "YYYY-MM-DD format" }
                },
                required: ['description', 'status', 'dueDate']
            }
        },
      }
    });

    const text = data.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    return [];
  }
};

export const classifyAndSummarizeAchievement = async (
  title: string, 
  description: string
): Promise<{ classification: AchievementType; summary: string }> => {
  try {
    const data = await callAIProxy({
      model: 'gemini-2.5-flash',
      contents: `Analyze this professional achievement.
      1. Classify it into one of: Leadership, Delivery, Communication, Impact, Other.
      2. Write a 1-sentence executive summary suitable for a performance review (manager-ready tone).
      
      Title: ${title}
      Description: ${description}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: "OBJECT",
            properties: {
              classification: { 
                type: "STRING", 
                enum: ['Leadership', 'Delivery', 'Communication', 'Impact', 'Other'] 
              },
              summary: { type: "STRING" }
            },
            required: ['classification', 'summary']
        }
      }
    });

    const text = data.text;
    if (!text) throw new Error("No response");
    return JSON.parse(text);
  } catch (error) {
    return { classification: AchievementType.OTHER, summary: description };
  }
};

export const generateReport = async (
  startDate: string,
  endDate: string,
  goals: Goal[],
  achievements: Achievement[],
  tasks: Task[],
  tone: string,
  type: string
): Promise<string> => {
  const relevantGoals = goals.map(g => `${g.title} (${g.progress}% complete)`).join('; ');
  const relevantAchievements = achievements.map(a => `- ${a.title} (${a.classification}): ${a.summary}`).join('\n');
  const relevantTasks = tasks
    .filter(t => t.status === 'completed' && t.completedAt && t.completedAt >= startDate && t.completedAt <= endDate)
    .map(t => `- [Completed Task] ${t.title}`)
    .join('\n');

  const prompt = `Write a ${type} Professional Performance Report.
  Date Range: ${startDate} to ${endDate}
  Tone: ${tone}
  
  Key Goals Context:
  ${relevantGoals}
  
  Achievements Logged:
  ${relevantAchievements}

  Completed Tasks (Ad-hoc items):
  ${relevantTasks}
  
  Structure the report with these Markdown headers:
  ## Executive Summary
  ## Key Achievements
  ## Operational Execution (Tasks & Milestones)
  ## Progress on Goals
  ## Focus for Next Period
  
  Keep it professional and actionable.`;

  try {
    const data = await callAIProxy({
      model: 'gemini-2.5-flash', 
      contents: prompt,
    });
    return data.text || "Could not generate report.";
  } catch (error) {
    return "Error generating report. Please check your connection.";
  }
};

export const generateReflection = async (habits: any[], goals: Goal[]): Promise<string> => {
  const habitSummary = habits.map(h => `${h.name}: Streak ${h.streakCount}`).join(', ');
  const goalSummary = goals.map(g => `${g.title} is ${g.progress}% done`).join(', ');

  try {
    const data = await callAIProxy({
      model: 'gemini-2.5-flash',
      contents: `Write a short, encouraging monthly reflection for a user based on this data:
      Habits: ${habitSummary}
      Goals: ${goalSummary}
      
      Give 3 bullet points on what went well and 1 suggestion for improvement.`,
    });
    return data.text || "Keep pushing forward!";
  } catch (error) {
    return "Great job staying consistent! Keep tracking to see AI insights.";
  }
};
