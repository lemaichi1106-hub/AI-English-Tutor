import React from 'react';
import { Topic } from '../types';
import { BookOpen, Coffee, Plane, Briefcase, ShoppingBag, Heart } from 'lucide-react';

interface TopicCardProps {
  topic: Topic;
  onSelect: (topic: Topic) => void;
}

const iconMap: Record<string, React.ElementType> = {
  'coffee': Coffee,
  'travel': Plane,
  'work': Briefcase,
  'shopping': ShoppingBag,
  'dating': Heart,
  'general': BookOpen,
};

export const TopicCard: React.FC<TopicCardProps> = ({ topic, onSelect }) => {
  const Icon = iconMap[topic.icon] || BookOpen;

  return (
    <div 
      onClick={() => onSelect(topic)}
      className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 cursor-pointer border border-slate-100 hover:border-indigo-100 overflow-hidden"
    >
      <div className="absolute top-0 right-0 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1 rounded-bl-xl">
        {topic.difficulty}
      </div>
      
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-4 group-hover:scale-110 transition-transform duration-300">
        <Icon size={24} />
      </div>
      
      <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
        {topic.title}
      </h3>
      
      <p className="text-slate-500 text-sm leading-relaxed">
        {topic.description}
      </p>

      <div className="mt-4 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 w-0 group-hover:w-full transition-all duration-500 ease-out"></div>
      </div>
    </div>
  );
};