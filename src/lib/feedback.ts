interface ExpressionAnalysis {
  expression: string;
  value: number;
}

interface FeedbackParams {
  question: string;
  answer: string;
  jobPosition: string;
  jobDescription: string;
  requiredExperience: number;
  requiredTechStack: string;
  candidateProfile: {
    position: string;
    experience: number;
    techStack: string;
    description: string;
    education: string;
    latestCompany: string;
    projects: string;
  };
  expressionAnalysis?: ExpressionAnalysis[];
}

export const generateFeedback = async ({
  question,
  answer,
  jobPosition,
  jobDescription,
  requiredExperience,
  requiredTechStack,
  candidateProfile,
  expressionAnalysis,
}: FeedbackParams) => {
  const prompt = `
    You are an expert technical interviewer. Please provide detailed feedback for the following interview response, including comprehensive analysis of both verbal and non-verbal communication.
    
    Job Position: ${jobPosition}
    Job Description: ${jobDescription}
    Required Experience: ${requiredExperience} years
    Required Tech Stack: ${requiredTechStack}
    
    Candidate Profile:
    - Current Position: ${candidateProfile.position}
    - Years of Experience: ${candidateProfile.experience}
    - Technical Skills: ${candidateProfile.techStack}
    - Experience Summary: ${candidateProfile.description}
    - Education: ${candidateProfile.education}
    - Latest Company: ${candidateProfile.latestCompany}
    - Notable Projects: ${candidateProfile.projects}
    
    Question: ${question}
    Answer: ${answer}
    
    ${expressionAnalysis ? `
    Facial Expression Analysis:
    ${expressionAnalysis.map(exp => `- ${exp.expression}: ${exp.value}%`).join('\n')}
    
    Please analyze the candidate's facial expressions and provide insights on:
    1. Confidence level based on facial expressions
    2. Engagement and interest in the topic
    3. Emotional state during the response
    4. Any signs of stress or discomfort
    5. Overall presentation demeanor
    6. Facial expressions that indicate understanding or confusion
    7. Eye contact and focus level
    8. Head movements and gestures
    9. Smile and enthusiasm level
    10. Overall body language and posture
    ` : ''}
    
    Please provide comprehensive feedback in the following format:
    1. Technical Accuracy (0-100)
    2. Clarity of Communication (0-100)
    3. Confidence Level (0-100)
    4. Areas for Improvement
    5. Strengths
    6. Overall Score (0-100)
    7. Detailed Feedback
    8. Non-verbal Communication Analysis
       - Facial Expression Insights
         * Dominant expressions and their meaning
         * Confidence indicators
         * Engagement level
         * Emotional state
       - Body Language Analysis
         * Posture and positioning
         * Hand movements and gestures
         * Eye contact and focus
         * Overall presentation style
       - Communication Style
         * Speaking pace and rhythm
         * Voice modulation
         * Clarity of expression
         * Professional demeanor
    9. Recommendations for Improvement
       - Technical Improvements
       - Communication Improvements
       - Presentation Improvements
       - Body Language Improvements
  `;

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate feedback");
    }

    const data = await response.json();
    return data.feedback;
  } catch (error) {
    console.error("Error generating feedback:", error);
    throw error;
  }
}; 