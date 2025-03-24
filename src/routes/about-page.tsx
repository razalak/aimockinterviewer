import { Container } from "@/components/container";
import { Users, Code, Brain, Star } from "lucide-react";

export const AboutPage = () => {
  const teamMembers = [
    {
      name: "Muhammed Razal",
      
    },
    {
      name: "Sreepriya KS",
    
    },
    {
      name: "Tissa Jacob",
      
    },
    {
      name: "Vimal Krishna",
      
    },
  ];

  return (
    <div className="flex-col w-full pb-24">
      <Container>
        {/* Hero Section */}
        <div className="my-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            About{" "}
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-transparent bg-clip-text">
              MockMate AI
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Your AI-powered interview preparation companion, designed to help you succeed
          </p>
        </div>

        {/* Project Description */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-purple-100">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">AI-Powered Analysis</h3>
                <p className="text-gray-600">
                  Our platform leverages advanced AI to analyze your responses,
                  facial expressions, and speech patterns in real-time, providing
                  comprehensive feedback to enhance your interview performance.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <Code className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Smart Technology</h3>
                <p className="text-gray-600">
                  Built with React, TypeScript, and advanced machine learning models,
                  MockMate AI delivers a seamless and intelligent interview practice
                  experience tailored to your needs.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <Star className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Key Features</h3>
                <ul className="text-gray-600 space-y-2">
                  <li>• Real-time feedback on your responses</li>
                  <li>• Facial expression and gesture analysis</li>
                  <li>• Speech recognition and clarity assessment</li>
                  <li>• Personalized improvement suggestions</li>
                  <li>• Comprehensive performance analytics</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-8 rounded-2xl">
            <h2 className="text-2xl font-semibold mb-6">Our Mission</h2>
            <p className="text-gray-600 mb-6">
              At MockMate AI, we're committed to democratizing interview preparation
              by providing accessible, AI-powered tools that help candidates build
              confidence and improve their interview skills. We believe everyone
              deserves the opportunity to present their best selves during interviews.
            </p>
            <p className="text-gray-600">
              Our platform combines cutting-edge artificial intelligence with
              human-centered design to create a comprehensive interview preparation
              experience that adapts to each user's unique needs and helps them
              achieve their career goals.
            </p>
          </div>
        </div>

        {/* Team Section */}
        <div className="mt-24">
          <div className="flex items-center gap-3 justify-center mb-12">
            <Users className="w-6 h-6 text-purple-600" />
            <h2 className="text-3xl font-bold">Project Team</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {teamMembers.map((member) => (
              <div
                key={member.name}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow duration-200"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-purple-600">
                    {member.name[0]}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{member.name}</h3>
                
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}; 