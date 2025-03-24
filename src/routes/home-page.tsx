import { ArrowRight, Sparkles } from "lucide-react";

import { Container } from "@/components/container";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const HomePage = () => {
  return (
    <div className="flex-col w-full pb-24">
      <Container>
        {/* Hero Section */}
        <div className="my-12 md:my-16">
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <h1 className="text-4xl md:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-transparent bg-clip-text">
                AI-Powered
              </span>
              <br />
              Interview Practice
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-2xl">
              Master your interview skills with real-time AI feedback, facial expression analysis, and personalized coaching.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link to="/generate">
                <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                  Start Practicing <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link to="/about">
                <Button size="lg" variant="outline">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 bg-gray-50 rounded-2xl p-8">
          <div className="text-center">
            <p className="text-4xl font-bold text-purple-600">250k+</p>
            <p className="mt-2 text-gray-600">Successful Interviews</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-purple-600">98%</p>
            <p className="mt-2 text-gray-600">User Satisfaction</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-purple-600">24/7</p>
            <p className="mt-2 text-gray-600">AI Availability</p>
          </div>
        </div>

        {/* Feature Image Section */}
        <div className="mt-16 relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100">
          <img
            src="/img/hero.jpg"
            alt="AI Interview Practice"
            className="w-full h-[500px] object-cover opacity-90"
          />
          <div className="absolute top-4 left-4 px-6 py-3 rounded-lg bg-white/90 backdrop-blur-sm">
            <p className="text-lg font-semibold text-purple-600">MockMate AI</p>
          </div>
        </div>
      </Container>

      {/* Features Section */}
      <Container className="py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <img
              src="/img/office.jpg"
              alt="Office Interview"
              className="w-full rounded-2xl shadow-lg"
            />
          </div>
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">
              Practice Makes Perfect
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 rounded-full bg-purple-100">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">AI-Powered Feedback</h3>
                  <p className="text-gray-600">Get instant, personalized feedback on your responses.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 rounded-full bg-blue-100">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Expression Analysis</h3>
                  <p className="text-gray-600">Understand how your facial expressions impact your interview.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 rounded-full bg-green-100">
                  <Sparkles className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">24/7 Availability</h3>
                  <p className="text-gray-600">Practice anytime, anywhere at your convenience.</p>
                </div>
              </div>
            </div>
            <Link to="/generate" className="inline-block">
              <Button size="lg" className="mt-6 bg-purple-600 hover:bg-purple-700">
                Start Practicing Now <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
};
