import { getClasses } from '@/actions/class';
import ReportsView from '@/components/reports/reports-view';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reports & Analytics | School Management',
  description: 'Comprehensive reports for attendance and fees.',
};

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const classes = await getClasses();
  
  interface ClassDoc {
    id: string;
    name: string;
    exams?: string[];
  }

  // Transform classes to match the expected interface { id: string, name: string }
  // getClasses returns { id: string, name: string, exams: string[] }
  const formattedClasses = classes.map((c: unknown) => {
    const cls = c as ClassDoc;
    return {
      id: cls.id,
      name: cls.name,
    };
  });

  return <ReportsView classes={formattedClasses} />;
}
