export const activityCategories = [
  {
    id: 'cardio',
    name: 'Cardio',
    icon: 'activity',
    description: 'Get your heart pumping',
    activities: [
      { id: 'cardio-walk', name: 'Brisk morning walk', duration: 15, icon: 'walk', details: 'Steady pace · Outdoor or treadmill' },
      { id: 'cardio-dance', name: 'Cardio intervals', duration: 12, icon: 'activity', details: '4 rounds · 30 sec on, 30 sec off' },
      { id: 'cardio-intervals', name: 'Low-impact cardio', duration: 10, icon: 'bolt', details: 'Beginner friendly · No equipment' },
    ],
  },
  {
    id: 'workout',
    name: 'Workout',
    icon: 'strength',
    description: 'Build strength, one rep at a time',
    activities: [
      { id: 'workout-full-body', name: 'Full body strength', duration: 20, icon: 'strength', details: '3 sets · 8–12 reps per exercise' },
      { id: 'workout-core', name: 'Core and stability', duration: 12, icon: 'target', details: '3 rounds · 4 exercises' },
      { id: 'workout-lower-body', name: 'Lower body circuit', duration: 15, icon: 'activity', details: '3 sets · Bodyweight or dumbbells' },
    ],
  },
  {
    id: 'yoga',
    name: 'Yoga',
    icon: 'yoga',
    description: 'Stretch, breathe, and reset',
    activities: [
      { id: 'yoga-morning-flow', name: 'Morning flow', duration: 15, icon: 'yoga', details: 'Gentle flow · All levels' },
      { id: 'yoga-stretch', name: 'Full-body stretch', duration: 10, icon: 'flexibility', details: 'Hold each stretch · 30 sec' },
      { id: 'yoga-breathwork', name: 'Breath and balance', duration: 8, icon: 'activity', details: 'Mindful movement · Easy pace' },
    ],
  },
];
