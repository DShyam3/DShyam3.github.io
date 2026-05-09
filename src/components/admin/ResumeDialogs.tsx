import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Experience, Education } from '@/hooks/useResume';

interface ExperienceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Experience, 'id'>) => Promise<void>;
  initialData?: Experience;
}

export function ExperienceDialog({ open, onOpenChange, onSave, initialData }: ExperienceDialogProps) {
  const [formData, setFormData] = useState<Omit<Experience, 'id'>>({
    title: '',
    company: '',
    location: '',
    start_date: '',
    end_date: '',
    logo_url: '',
    description: '',
    order: 0,
  });

  useEffect(() => {
    if (initialData) {
      const { id, ...rest } = initialData;
      setFormData(rest);
    } else {
      setFormData({
        title: '',
        company: '',
        location: '',
        start_date: '',
        end_date: '',
        logo_url: '',
        description: '',
        order: 0,
      });
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Experience' : 'Add Experience'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Job Title</label>
              <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Company</label>
              <Input value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Location</label>
            <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} placeholder="e.g. Sep 2021" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} placeholder="e.g. Present" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Logo URL</label>
            <Input value={formData.logo_url} onChange={e => setFormData({ ...formData, logo_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (Optional)</label>
            <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="min-h-[100px]" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Order</label>
            <Input type="number" value={formData.order} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EducationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Education, 'id'>) => Promise<void>;
  initialData?: Education;
}

export function EducationDialog({ open, onOpenChange, onSave, initialData }: EducationDialogProps) {
  const [formData, setFormData] = useState<Omit<Education, 'id'>>({
    degree: '',
    school: '',
    start_date: '',
    end_date: '',
    logo_url: '',
    order: 0,
  });

  useEffect(() => {
    if (initialData) {
      const { id, ...rest } = initialData;
      setFormData(rest);
    } else {
      setFormData({
        degree: '',
        school: '',
        start_date: '',
        end_date: '',
        logo_url: '',
        order: 0,
      });
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Education' : 'Add Education'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Degree / Certification</label>
            <Input value={formData.degree} onChange={e => setFormData({ ...formData, degree: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">School / University</label>
            <Input value={formData.school} onChange={e => setFormData({ ...formData, school: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Logo URL</label>
            <Input value={formData.logo_url} onChange={e => setFormData({ ...formData, logo_url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Order</label>
            <Input type="number" value={formData.order} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
