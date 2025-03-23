interface Project {
  name: string;
  description: string;
  technologies: string[];
  duration?: string;
  role?: string;
}

interface ParsedResume {
  text: string;
  skills: string[];
  experience: string[];
  education: string[];
  projects: Project[];
  achievements: string[];
  certifications: string[];
}

const commonSkills = [
  'javascript', 'typescript', 'react', 'angular', 'vue', 'node.js', 'python',
  'java', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'sql',
  'mongodb', 'postgresql', 'mysql', 'redis', 'aws', 'azure', 'gcp',
  'docker', 'kubernetes', 'git', 'ci/cd', 'agile', 'scrum', 'jira',
  'linux', 'unix', 'macos', 'windows', 'rest', 'graphql', 'soap',
  'microservices', 'api', 'web', 'mobile', 'desktop', 'cloud', 'devops',
  'security', 'testing', 'qa', 'ui', 'ux', 'design', 'analytics'
];

const extractSkills = (text: string): string[] => {
  const words = text.toLowerCase().split(/\s+/);
  const foundSkills = new Set<string>();

  words.forEach(word => {
    if (commonSkills.includes(word)) {
      foundSkills.add(word);
    }
  });

  return Array.from(foundSkills);
};

const extractExperience = (text: string): string[] => {
  const experiencePattern = /(?:experience|work history|employment|work experience)[:.]?\s*([^]*?)(?=\n\s*(?:education|projects|skills|certifications|$))/i;
  const match = text.match(experiencePattern);
  
  if (!match) return [];
  
  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.toLowerCase().includes('experience'));
};

const extractEducation = (text: string): string[] => {
  const educationPattern = /(?:education|academic|qualification)[:.]?\s*([^]*?)(?=\n\s*(?:experience|projects|skills|certifications|$))/i;
  const match = text.match(educationPattern);
  
  if (!match) return [];
  
  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.toLowerCase().includes('education'));
};

const extractProjects = (text: string): Project[] => {
  const projectPattern = /(?:projects|portfolio|work)[:.]?\s*([^]*?)(?=\n\s*(?:experience|education|skills|certifications|$))/i;
  const match = text.match(projectPattern);
  
  if (!match) return [];
  
  const projectLines = match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.toLowerCase().includes('projects'));

  const projects: Project[] = [];
  let currentProject: Partial<Project> = {
    technologies: [],
  };

  projectLines.forEach(line => {
    // Check if this line is a project title (usually shorter and might contain dates)
    if (line.length < 100 && (line.includes('(') || line.includes(')') || line.includes('202') || line.includes('20'))) {
      if (currentProject.name && currentProject.description) {
        projects.push(currentProject as Project);
      }
      currentProject = {
        name: line,
        description: '',
        technologies: [],
      };
    } else if (currentProject.name) {
      // Add to description if it's not a title
      currentProject.description += (currentProject.description ? '\n' : '') + line;
      
      // Extract technologies from description
      const techWords = line.toLowerCase().split(/\s+/);
      techWords.forEach(word => {
        if (commonSkills.includes(word)) {
          currentProject.technologies = [...new Set([...(currentProject.technologies || []), word])];
        }
      });
    }
  });

  // Add the last project if exists
  if (currentProject.name && currentProject.description) {
    projects.push(currentProject as Project);
  }

  return projects;
};

const extractAchievements = (text: string): string[] => {
  const achievementPattern = /(?:achievements|accomplishments|awards)[:.]?\s*([^]*?)(?=\n\s*(?:experience|education|projects|skills|certifications|$))/i;
  const match = text.match(achievementPattern);
  
  if (!match) return [];
  
  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.toLowerCase().includes('achievements'));
};

const extractCertifications = (text: string): string[] => {
  const certificationPattern = /(?:certifications|certificates|qualifications)[:.]?\s*([^]*?)(?=\n\s*(?:experience|education|projects|skills|achievements|$))/i;
  const match = text.match(certificationPattern);
  
  if (!match) return [];
  
  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.toLowerCase().includes('certifications'));
};

export const parseResume = async (file: File): Promise<ParsedResume> => {
  try {
    // Read file content as text
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });

    // Extract information from the text
    const skills = extractSkills(text);
    const experience = extractExperience(text);
    const education = extractEducation(text);
    const projects = extractProjects(text);
    const achievements = extractAchievements(text);
    const certifications = extractCertifications(text);

    return {
      text,
      skills,
      experience,
      education,
      projects,
      achievements,
      certifications,
    };
  } catch (error) {
    console.error('Error parsing resume:', error);
    throw new Error('Failed to parse resume. Please try again.');
  }
};

export const generateResumeQuestions = (parsedResume: ParsedResume): string[] => {
  const questions: string[] = [];

  // Project-based questions
  if (parsedResume.projects.length > 0) {
    parsedResume.projects.forEach((project, index) => {
      if (index < 2) { // Limit to 2 project questions
        // Architecture and Design Questions
        questions.push(`In your project "${project.name}", what architectural decisions did you make and why? How did you ensure scalability and maintainability?`);
        
        // Technical Implementation Questions
        if (project.technologies.length > 0) {
          questions.push(`For ${project.name}, you used ${project.technologies.join(', ')}. Can you walk me through a specific technical challenge you faced and how you solved it?`);
        }
        
        // Problem-Solving Questions
        questions.push(`What was the most challenging problem you encountered while working on ${project.name}? How did you approach and solve it?`);
        
        // Impact and Results Questions
        questions.push(`What was the impact of ${project.name} on the business or users? How did you measure its success?`);
        
        // Learning and Growth Questions
        questions.push(`What did you learn from working on ${project.name}? How would you improve it if you had to do it again?`);
      }
    });
  }

  // Skills-based questions
  if (parsedResume.skills.length > 0) {
    const relevantSkills = parsedResume.skills.slice(0, 3);
    questions.push(`I see you have experience with ${relevantSkills.join(', ')}. Can you tell me about a specific problem you solved using these technologies?`);
    questions.push(`How do you stay updated with the latest developments in ${relevantSkills[0]}? Can you share an example of implementing a recent feature or improvement?`);
  }

  // Experience-based questions
  if (parsedResume.experience.length > 0) {
    const latestExperience = parsedResume.experience[0];
    questions.push(`In your role at ${latestExperience}, what was your most significant technical achievement? How did it impact the business?`);
    questions.push(`Can you describe a challenging technical problem you encountered at ${latestExperience} and how you resolved it?`);
  }

  // Achievement-based questions
  if (parsedResume.achievements.length > 0) {
    questions.push(`I notice you achieved ${parsedResume.achievements[0]}. Can you tell me about the process and what you learned from this experience?`);
  }

  // Certification-based questions
  if (parsedResume.certifications.length > 0) {
    questions.push(`You have certification in ${parsedResume.certifications[0]}. How has this certification helped you in your work?`);
  }

  // Education-based questions
  if (parsedResume.education.length > 0) {
    questions.push(`Your education background includes ${parsedResume.education[0]}. How has this influenced your technical approach to problem-solving?`);
  }

  return questions;
}; 