import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { CustomBreadCrumb } from "@/components/custom-bread-crumb";
import { Headings } from "@/components/headings";
import { Button } from "@/components/ui/button";
import { Loader, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { chatSession } from "@/scripts/ai-studio";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase.config";
import { toast } from "sonner";
import { Interview } from "@/types";
import { parseResume, generateResumeQuestions } from "@/utils/resume-parser";

interface FormMockInterview {
  initialData: Interview | null;
}

const formSchema = z.object({
  // Job Requirements
  jobPosition: z
    .string()
    .min(1, "Position is required")
    .max(100, "Position must be 100 characters or less"),
  jobDescription: z.string().min(10, "Description is required"),
  requiredExperience: z.coerce
    .number()
    .min(0, "Experience cannot be empty or negative"),
  requiredTechStack: z.string().min(1, "Tech stack must be at least a character"),
  
  // Candidate Profile
  candidateProfile: z.object({
    resumeFileName: z.string().optional(), // Store file name instead of File object
    position: z.string().min(1, "Current position is required"),
    experience: z.coerce.number().min(0, "Experience cannot be negative"),
    techStack: z.string().min(1, "Tech stack is required"),
    description: z.string().min(10, "Description is required"),
    education: z.string().min(1, "Education details are required"),
    latestCompany: z.string().min(1, "Latest company is required"),
    projects: z.string().min(10, "Project details are required"),
  }),
});

type FormData = z.infer<typeof formSchema>;

export const FormMockInterview = ({ initialData }: FormMockInterview) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobPosition: initialData?.position || '',
      jobDescription: initialData?.description || '',
      requiredExperience: initialData?.experience || 0,
      requiredTechStack: initialData?.techStack || '',
      candidateProfile: {
        resumeFileName: undefined,
        position: '',
        experience: 0,
        techStack: '',
        description: '',
        education: '',
        latestCompany: '',
        projects: '',
      },
    },
  });

  const { isValid, isSubmitting } = form.formState;
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [resumeQuestions, setResumeQuestions] = useState<string[]>([]);
  const [isParsingResume, setIsParsingResume] = useState(false);

  const title = initialData
    ? initialData.position
    : "Create a new mock interview";

  const breadCrumpPage = initialData ? initialData?.position : "Create";
  const actions = initialData ? "Save Changes" : "Create";
  const toastMessage = initialData
    ? { title: "Updated..!", description: "Changes saved successfully..." }
    : { title: "Created..!", description: "New Mock Interview created..." };

  const cleanJsonResponse = (responseText: string) => {
    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/(json|```|`)/g, "");
    const jsonArrayMatch = cleanText.match(/\[.*\]/s);
    if (jsonArrayMatch) {
      cleanText = jsonArrayMatch[0];
    } else {
      throw new Error("No JSON array found in response");
    }
    try {
      return JSON.parse(cleanText);
    } catch (error) {
      throw new Error("Invalid JSON format: " + (error as Error)?.message);
    }
  };

  const handleResumeUpload = async (file: File) => {
    try {
      setIsParsingResume(true);
      const parsedResume = await parseResume(file);
      const questions = generateResumeQuestions(parsedResume);
      setResumeQuestions(questions);
      
      // Update form with parsed information
      form.setValue('candidateProfile.projects', parsedResume.projects.join('\n'));
      form.setValue('candidateProfile.techStack', parsedResume.skills.join(', '));
      form.setValue('candidateProfile.resumeFileName', file.name);
      
      toast.success("Resume parsed successfully", {
        description: "Resume information has been extracted and questions generated.",
      });
    } catch (error) {
      console.error('Error handling resume:', error);
      toast.error("Failed to parse resume", {
        description: "Please try uploading the resume again.",
      });
    } finally {
      setIsParsingResume(false);
    }
  };

  const generateAiResult = async (data: FormData) => {
    const prompt = `
      As an experienced prompt engineer, generate a JSON array containing 10 interview questions along with detailed answers based on the following information. The questions should be a mix of technical and behavioral questions.

      Job Requirements:
      - Job Position: ${data?.jobPosition}
      - Job Description: ${data?.jobDescription}
      - Years of Experience Required: ${data?.requiredExperience}
      - Required Tech Stacks: ${data?.requiredTechStack}

      Candidate Profile:
      - Current Position: ${data?.candidateProfile?.position}
      - Years of Experience: ${data?.candidateProfile?.experience}
      - Technical Skills: ${data?.candidateProfile?.techStack}
      - Experience Summary: ${data?.candidateProfile?.description}
      - Projects: ${data?.candidateProfile?.projects}

      Resume-Based Questions:
      ${resumeQuestions.map(q => `- ${q}`).join('\n')}

      Generate 10 questions with the following distribution:
      1. Technical Questions (6 questions):
         - 2 questions based on the required tech stack and job requirements
         - 2 questions based on the candidate's technical skills and experience
         - 2 questions that bridge the gap between candidate's experience and job requirements
         Include a mix of:
         - System design
         - Architecture decisions
         - Best practices
         - Problem-solving scenarios

      2. Behavioral Questions (4 questions):
         - 2 questions about past experiences from their resume
         - 2 questions about how they would handle situations relevant to the job role
         Focus on:
         - Leadership experience
         - Team collaboration
         - Problem-solving approach
         - Communication skills
         - Project management
         - Handling challenges

      For each question, provide:
      1. The question text
      2. A detailed answer that includes:
         - Key points to cover
         - Best practices to mention
         - Common pitfalls to avoid
         - Expected level of detail based on experience

      Please format the output strictly as an array of JSON objects without any additional labels, code blocks, or explanations. Return only the JSON array with questions and answers.
    `;

    const aiResult = await chatSession.sendMessage(prompt);
    const cleanedResponse = cleanJsonResponse(aiResult.response.text());

    return cleanedResponse;
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true);

      if (initialData) {
        if (isValid) {
          const aiResult = await generateAiResult(data);

          await updateDoc(doc(db, "interviews", initialData?.id), {
            questions: aiResult,
            ...data,
            updatedAt: serverTimestamp(),
          });

          toast(toastMessage.title, { description: toastMessage.description });
        }
      } else {
        if (isValid) {
          const aiResult = await generateAiResult(data);

          const interviewRef = await addDoc(collection(db, "interviews"), {
            ...data,
            userId,
            questions: aiResult,
            createdAt: serverTimestamp(),
          });

          const id = interviewRef.id;

          await updateDoc(doc(db, "interviews", id), {
            id,
            updatedAt: serverTimestamp(),
          });

          toast(toastMessage.title, { description: toastMessage.description });
        }
      }

      navigate("/generate", { replace: true });
    } catch (error) {
      console.log(error);
      toast.error("Error..", {
        description: `Something went wrong. Please try again later`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      form.reset({
        jobPosition: initialData.position,
        jobDescription: initialData.description,
        requiredExperience: initialData.experience,
        requiredTechStack: initialData.techStack,
        candidateProfile: {
          resumeFileName: initialData.candidateProfile?.resumeFileName || undefined,
          position: initialData.candidateProfile?.position || '',
          experience: initialData.candidateProfile?.experience || 0,
          techStack: initialData.candidateProfile?.techStack || '',
          description: initialData.candidateProfile?.description || '',
          education: initialData.candidateProfile?.education || '',
          latestCompany: initialData.candidateProfile?.latestCompany || '',
          projects: initialData.candidateProfile?.projects || '',
        },
      });
    }
  }, [initialData, form]);

  return (
    <div className="w-full flex-col space-y-4">
      {/* Bread Crumb */}
      <CustomBreadCrumb
        breadCrumbPage={breadCrumpPage}
        breadCrumpItems={[{ label: "Mock Interviews", link: "/generate" }]}
      />

      <div className="mt-4 flex items-center justify-between w-full">
        <Headings title={title} isSubHeading />

        {initialData && (
          <Button size={"icon"} variant={"ghost"}>
            <Trash2 className="text-red-500 min-w-4 min-h-4" />
          </Button>
        )}
      </div>

      <Separator className="my-4" />

      <div className="my-6"></div>

      <FormProvider {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full p-8 rounded-lg flex-col flex items-start justify-start gap-6 shadow-md"
        >
          {/* Job Requirements Section */}
          <div className="w-full space-y-4">
            <h3 className="text-lg font-semibold">Job Requirements</h3>
            <FormField
              control={form.control}
              name="jobPosition"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Job Role / Position Required</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Input
                      className="h-12"
                      disabled={isLoading}
                      placeholder="eg:- Full Stack Developer"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobDescription"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Job Description</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Textarea
                      className="h-12"
                      disabled={isLoading}
                      placeholder="eg:- describe the job requirements"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requiredExperience"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Required Years of Experience</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      className="h-12"
                      disabled={isLoading}
                      placeholder="eg:- 5 Years"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requiredTechStack"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Required Tech Stack</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Textarea
                      className="h-12"
                      disabled={isLoading}
                      placeholder="eg:- React, TypeScript, Node.js"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <Separator className="my-4" />

          {/* Candidate Profile Section */}
          <div className="w-full space-y-4">
            <h3 className="text-lg font-semibold">Candidate Profile</h3>
            
            <FormField
              control={form.control}
              name="candidateProfile.resumeFileName"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Resume</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <div className="flex items-center gap-4">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="h-12"
                        disabled={isLoading || isParsingResume}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            onChange(file.name);
                            await handleResumeUpload(file);
                          }
                        }}
                        {...field}
                      />
                      {value && (
                        <span className="text-sm text-gray-500">
                          {value}
                        </span>
                      )}
                      {isParsingResume && (
                        <Loader className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="candidateProfile.position"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Current Position</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Input
                      className="h-12"
                      disabled={isLoading}
                      placeholder="eg:- Senior Software Engineer"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="candidateProfile.latestCompany"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Latest Company</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Input
                      className="h-12"
                      disabled={isLoading}
                      placeholder="eg:- Google, Microsoft, Amazon"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="candidateProfile.experience"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Years of Experience</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      className="h-12"
                      disabled={isLoading}
                      placeholder="eg:- 5 Years"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="candidateProfile.education"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Education</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Input
                      className="h-12"
                      disabled={isLoading}
                      placeholder="eg:- B.Tech in Computer Science from MIT"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="candidateProfile.techStack"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Technical Skills</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Textarea
                      className="h-12"
                      disabled={isLoading}
                      placeholder="eg:- React, TypeScript, Node.js, AWS"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="candidateProfile.projects"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Notable Projects</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Textarea
                      className="h-24"
                      disabled={isLoading}
                      placeholder="eg:- Briefly describe your key projects, their impact, and your role"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="candidateProfile.description"
              render={({ field }) => (
                <FormItem className="w-full space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <FormLabel>Experience Summary</FormLabel>
                    <FormMessage className="text-sm" />
                  </div>
                  <FormControl>
                    <Textarea
                      className="h-24"
                      disabled={isLoading}
                      placeholder="eg:- Brief summary of your experience and expertise"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="w-full flex items-center justify-end gap-6">
            <Button
              type="reset"
              size={"sm"}
              variant={"outline"}
              disabled={isSubmitting || isLoading}
            >
              Reset
            </Button>
            <Button
              type="submit"
              size={"sm"}
              disabled={isSubmitting || !isValid || isLoading}
            >
              {isLoading ? (
                <Loader className="text-gray-50 animate-spin" />
              ) : (
                actions
              )}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
