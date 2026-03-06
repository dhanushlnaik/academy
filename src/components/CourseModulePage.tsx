'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/monitoring';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ChevronRight,
  ListTodo,
  BookOpen,
  MessageCircle,
  Users,
  Trophy,
  Clock,
  Target,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EnhancedLessonViewer from './EnhancedLessonViewer';
import DiscussionBoard from './DiscussionBoard';

interface ModuleItem {
  id: string;
  title: string;
  description: string;
  estimatedTime: string;
  lessons: LessonItem[];
  rewardBadge?: string;
  icon?: string;
}

interface LessonItem {
  id: string;
  lessonNumber?: number;
  title: string;
  content: string;
  duration: string;
  type: 'reading' | 'video' | 'quiz' | 'coding' | 'project' | 'discussion';
  xpReward: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  keyTakeaways: string[];
  videoUrl?: string;
  quiz?: {
    questions: Array<{
      id: string;
      question: string;
      options: string[];
      correct: number;
      explanation: string;
    }>;
    passingScore: number;
  };
}

interface CourseModulePageProps {
  courseId: string;
  courseName: string;
  modules: ModuleItem[];
  totalLessons: number;
  badge?: string;
  onProgress?: (progress: number) => void;
}

interface DiscussionThread {
  id: string;
  author: {
    name: string;
    avatar: string;
    level: number;
    badge?: string;
  };
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  likes: number;
  replies: any[];
  isAnswered: boolean;
  helpfulCount: number;
  category: 'question' | 'discussion' | 'resource' | 'bug-report';
  tags: string[];
  isLiked?: boolean;
}

export default function CourseModulePage({
  courseId,
  courseName,
  modules,
  totalLessons,
  badge,
  onProgress
}: CourseModulePageProps) {
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(modules[0] || null);
  const [selectedLesson, setSelectedLesson] = useState<LessonItem | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'lesson' | 'discussion'>('lesson');
  const [discussionThreads, setDiscussionThreads] = useState<DiscussionThread[]>([]);

  const totalModules = modules.length;
  const completedModules = modules.filter(m =>
    m.lessons.every(l => completedLessons.includes(l.id))
  ).length;
  const progressPercentage = (completedLessons.length / totalLessons) * 100;

  useEffect(() => {
    onProgress?.(progressPercentage);
  }, [progressPercentage, onProgress]);

  // Scroll to top whenever a new lesson is selected
  useEffect(() => {
    if (selectedLesson) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedLesson]);

  const handleLessonComplete = (lessonId: string) => {
    const newCompleted = [...new Set([...completedLessons, lessonId])];
    setCompletedLessons(newCompleted);

    // Sync progress to backend
    fetch('/api/user/course/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        courseSlug: courseId,
        completedCount: newCompleted.length,
        totalModules: totalLessons,
        completedModules: newCompleted
      })
    }).catch(err => logger.error('Failed to sync progress', 'CourseModulePage', undefined, err));
  };

  const handleNewThread = (thread: Partial<DiscussionThread>) => {
    const newThread: DiscussionThread = {
      id: `thread-${Date.now()}`,
      author: { name: 'You', avatar: '👤', level: 1 },
      title: thread.title || '',
      content: thread.content || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      likes: 0,
      replies: [],
      isAnswered: false,
      helpfulCount: 0,
      category: 'discussion',
      tags: [],
      ...thread
    };
    setDiscussionThreads(prev => [newThread, ...prev]);
  };

  if (!selectedModule) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-slate-400">No modules available</p>
      </div>
    );
  }

  if (selectedLesson && activeTab === 'lesson') {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <button
            onClick={() => setSelectedLesson(null)}
            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mb-6"
          >
            ← Back to {selectedModule.title}
          </button>

        <EnhancedLessonViewer
            lesson={{
              id: selectedLesson.lessonNumber || parseInt(selectedLesson.id.split('-l')[1]) || 1,
              title: selectedLesson.title,
              content: selectedLesson.content,
              duration: parseInt(selectedLesson.duration) || 20,
              type: selectedLesson.type as 'reading' | 'video' | 'quiz' | 'coding' | 'project',
              xpReward: selectedLesson.xpReward,
              difficulty: selectedLesson.difficulty === 'Beginner' ? 'Easy' : selectedLesson.difficulty === 'Intermediate' ? 'Medium' : 'Hard',
              keyTakeaways: selectedLesson.keyTakeaways,
              videoUrl: selectedLesson.videoUrl,
              quiz: selectedLesson.quiz ? {
                questions: selectedLesson.quiz.questions.map(q => ({
                  id: parseInt(q.id.replace(/\D/g, '')) || 1,
                  question: q.question,
                  options: q.options,
                  correct: q.correct,
                  explanation: q.explanation
                })),
                passingScore: selectedLesson.quiz.passingScore
              } : undefined
            }}
            courseContext={{
              courseId,
              courseName,
              totalLessons,
              badge: badge || '📚',
              currentModuleIndex: modules.findIndex(m => m.id === selectedModule.id),
              completedLessons: completedLessons.map(id => parseInt(id.split('-l')[1]) || 0).filter(id => id > 0)
            }}
            onComplete={() => {
              handleLessonComplete(selectedLesson.id);
              const nextLessonIndex = selectedModule.lessons.findIndex(l => l.id === selectedLesson.id) + 1;
              if (nextLessonIndex < selectedModule.lessons.length) {
                setSelectedLesson(selectedModule.lessons[nextLessonIndex]);
              }
            }}
            onNavigate={(direction) => {
              const currentIndex = selectedModule.lessons.findIndex(l => l.id === selectedLesson.id);
              if (direction === 'next' && currentIndex < selectedModule.lessons.length - 1) {
                setSelectedLesson(selectedModule.lessons[currentIndex + 1]);
              } else if (direction === 'prev' && currentIndex > 0) {
                setSelectedLesson(selectedModule.lessons[currentIndex - 1]);
              }
            }}
          />

          {/* Discussion Section */}
          <div className="mt-12">
            <DiscussionBoard
              courseId={courseId}
              lessonId={selectedLesson.id}
              threads={discussionThreads}
              onNewThread={handleNewThread}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header with Progress */}
      <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-b border-slate-700 sticky top-0 z-40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{courseName}</h1>
              <p className="text-slate-400">
                {completedLessons.length} of {totalLessons} lessons completed
              </p>
            </div>
            {badge && <span className="text-4xl">{badge}</span>}
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex items-center justify-between mt-2 text-sm text-slate-400">
            <span>{Math.round(progressPercentage)}% Complete</span>
            <span>
              {completedModules}/{totalModules} modules finished
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Modules Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <Card className="bg-slate-900/50 border-slate-700 sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Course Modules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {modules.map((module, index) => {
                  const moduleProgress = module.lessons.filter(l =>
                    completedLessons.includes(l.id)
                  ).length / module.lessons.length * 100;

                  // Module is unlocked if it's the first one, or all lessons
                  // in the preceding module are completed
                  const isModuleUnlocked = index === 0 ||
                    modules[index - 1].lessons.every(l => completedLessons.includes(l.id));

                  return (
                    <motion.button
                      key={module.id}
                      onClick={() => {
                        if (isModuleUnlocked) {
                          setSelectedModule(module);
                          setSelectedLesson(null);
                        } else {
                          import('sonner').then(({ toast }) =>
                            toast.error('Complete the previous module first!')
                          );
                        }
                      }}
                      whileHover={{ x: isModuleUnlocked ? 4 : 0 }}
                      className={`w-full p-3 rounded-lg text-left transition-all border ${
                        !isModuleUnlocked
                          ? 'bg-slate-800/20 border-slate-800 opacity-50 cursor-not-allowed'
                          : selectedModule.id === module.id
                            ? 'bg-cyan-600/20 border-cyan-400/50'
                            : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {!isModuleUnlocked && <Lock className="h-4 w-4 text-slate-500 flex-shrink-0" />}
                        <span className="text-lg">{module.icon || '📚'}</span>
                        <h3 className={`font-medium text-sm truncate ${isModuleUnlocked ? 'text-white' : 'text-slate-500'}`}>
                          {module.title}
                        </h3>
                      </div>
                      <Progress value={moduleProgress} className="h-1 mb-1" />
                      <p className="text-xs text-slate-400">
                        {module.lessons.filter(l => completedLessons.includes(l.id)).length}/{module.lessons.length} lessons
                      </p>
                    </motion.button>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3 space-y-6"
          >
            {/* Module Header */}
            <Card className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-slate-700">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{selectedModule.icon || '📚'}</span>
                      <Badge className="bg-cyan-600/30 text-cyan-300">Module {modules.findIndex(m => m.id === selectedModule.id) + 1}</Badge>
                    </div>
                    <CardTitle className="text-2xl text-white mb-2">
                      {selectedModule.title}
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      {selectedModule.description}
                    </CardDescription>
                  </div>
                  {selectedModule.rewardBadge && (
                    <div className="text-center">
                      <span className="text-3xl mb-1 block">{selectedModule.rewardBadge}</span>
                      <p className="text-xs text-slate-400">Module Badge</p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {selectedModule.estimatedTime}
                  </div>
                  <div className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4" />
                    {selectedModule.lessons.length} lessons
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    {selectedModule.lessons.reduce((sum, l) => sum + l.xpReward, 0)} XP
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lessons List */}
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-white">Lessons</h2>
              <AnimatePresence>
                {selectedModule.lessons.map((lesson, index) => {
                  const isCompleted = completedLessons.includes(lesson.id);
                  // A lesson is unlocked if it's the first in the module,
                  // or all preceding lessons in this module are completed
                  const isUnlocked = index === 0 ||
                    selectedModule.lessons
                      .slice(0, index)
                      .every(prev => completedLessons.includes(prev.id));

                  return (
                    <motion.div
                      key={lesson.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card
                        onClick={() => {
                          if (isUnlocked) {
                            setSelectedLesson(lesson);
                          } else {
                            // Optionally show a toast or do nothing
                            import('sonner').then(({ toast }) =>
                              toast.error('Complete the previous lessons first!')
                            );
                          }
                        }}
                        className={`transition-all border ${
                          !isUnlocked
                            ? 'bg-slate-900/30 border-slate-800 opacity-60 cursor-not-allowed'
                            : isCompleted
                              ? 'bg-slate-900/60 border-emerald-400/30 hover:border-emerald-400/50 cursor-pointer'
                              : 'bg-slate-900/60 border-slate-700 hover:border-cyan-400/50 cursor-pointer'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {isCompleted && (
                                  <span className="text-emerald-400">✓</span>
                                )}
                                {!isUnlocked && !isCompleted && (
                                  <Lock className="h-4 w-4 text-slate-500" />
                                )}
                                <span className="text-lg">
                                  {lesson.type === 'reading' && '📖'}
                                  {lesson.type === 'video' && '🎥'}
                                  {lesson.type === 'quiz' && '📝'}
                                  {lesson.type === 'coding' && '💻'}
                                  {lesson.type === 'project' && '🚀'}
                                  {lesson.type === 'discussion' && '💬'}
                                </span>
                                <h3 className={`font-semibold text-sm ${
                                  !isUnlocked ? 'text-slate-500' :
                                  isCompleted ? 'text-slate-300 line-through' : 'text-white'
                                }`}>
                                  Lesson {index + 1}: {lesson.title}
                                </h3>
                              </div>
                              <p className="text-xs text-slate-400 ml-6">
                                {lesson.duration} • {lesson.difficulty} • +{lesson.xpReward} XP
                              </p>
                            </div>
                            <motion.div
                              animate={{ x: 0 }}
                              whileHover={{ x: isUnlocked ? 4 : 0 }}
                            >
                              {isUnlocked
                                ? <ChevronRight className="h-5 w-5 text-slate-400" />
                                : <Lock className="h-5 w-5 text-slate-600" />
                              }
                            </motion.div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
