'use client';

import * as React from 'react';
import { X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTags, useCreateTag } from '@/hooks/use-api';
import type { Tag } from '@/hooks/use-api';
import { cn } from '@/lib/utils';

interface TagInputProps {
  selectedTags: Tag[];
  onChange: (tags: Tag[]) => void;
  className?: string;
}

const TAG_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export function TagInput({ selectedTags, onChange, className }: TagInputProps) {
  const [open, setOpen] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const { data: tags = [], isLoading } = useTags();
  const createTag = useCreateTag();

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      await createTag.mutateAsync({ name: newTagName, color });
      setNewTagName('');
    } catch (error) {
    }
  };

  const handleToggleTag = (tag: Tag) => {
    const isSelected = selectedTags.some((t) => t.id === tag.id);
    if (isSelected) {
      onChange(selectedTags.filter((t) => t.id !== tag.id));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTags.filter((t) => t.id !== tagId));
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="outline"
            style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
            className="gap-1"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-1 hover:opacity-70"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        {/* Add Tag Button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 gap-1">
              <Plus className="h-3 w-3" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-3">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Select Tags</h4>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tags yet</p>
                  ) : (
                    tags.map((tag) => {
                      const isSelected = selectedTags.some((t) => t.id === tag.id);
                      return (
                        <Badge
                          key={tag.id}
                          variant={isSelected ? 'default' : 'outline'}
                          style={
                            isSelected
                              ? (tag.color ? { backgroundColor: tag.color, borderColor: tag.color } : undefined)
                              : (tag.color ? { borderColor: tag.color, color: tag.color } : undefined)
                          }
                          className="cursor-pointer"
                          onClick={() => handleToggleTag(tag)}
                        >
                          {tag.name}
                        </Badge>
                      );
                    })
                  )}
                </div>
              </div>
              
              <div className="space-y-2 pt-2 border-t">
                <h4 className="font-medium text-sm">Create New Tag</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateTag();
                      }
                    }}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || createTag.isPending}
                  >
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
