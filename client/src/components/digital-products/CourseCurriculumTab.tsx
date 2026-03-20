import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ItemStatus = "draft" | "published";

interface Chapter {
  id: string;
  title: string;
  introVideoUrl: string;
  status: ItemStatus;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  videoDurationSeconds: number | null;
  isFreePreview: boolean;
  status: ItemStatus;
}

interface Props {
  siteId: string;
  courseId?: string;
}

interface LessonDraftState {
  title: string;
  description: string;
  videoUrl: string;
  videoDurationSeconds: string;
  isFreePreview: boolean;
  status: ItemStatus;
}

interface ChapterDraftState {
  title: string;
  introVideoUrl: string;
  status: ItemStatus;
}

type DeleteTarget =
  | { type: "chapter"; chapterId: string; label: string }
  | { type: "lesson"; chapterId: string; lessonId: string; label: string }
  | null;

function toStatus(value: unknown): ItemStatus {
  return value === "published" ? "published" : "draft";
}

function normalizeChapter(raw: Record<string, unknown>): Chapter {
  return {
    id: String(raw.id ?? ""),
    title: typeof raw.title === "string" ? raw.title : "",
    introVideoUrl: typeof raw.introVideoUrl === "string" ? raw.introVideoUrl : "",
    status: toStatus(raw.status),
  };
}

function normalizeLesson(raw: Record<string, unknown>): Lesson {
  return {
    id: String(raw.id ?? ""),
    title: typeof raw.title === "string" ? raw.title : "",
    description: typeof raw.description === "string" ? raw.description : "",
    videoUrl: typeof raw.videoUrl === "string" ? raw.videoUrl : "",
    videoDurationSeconds:
      typeof raw.videoDurationSeconds === "number" && Number.isFinite(raw.videoDurationSeconds)
        ? raw.videoDurationSeconds
        : null,
    isFreePreview: raw.isFreePreview === true,
    status: toStatus(raw.status),
  };
}

function getArrayPayload(payload: unknown, key: string): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const candidate = (payload as Record<string, unknown>)[key];
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
  }
  return [];
}

function trimmedOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildChapterPayload(draft: ChapterDraftState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: draft.title.trim(),
    status: draft.status,
  };
  const introVideoUrl = trimmedOrUndefined(draft.introVideoUrl);
  if (introVideoUrl !== undefined) {
    payload.introVideoUrl = introVideoUrl;
  }
  return payload;
}

function buildLessonPayload(draft: LessonDraftState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: draft.title.trim(),
    isFreePreview: draft.isFreePreview,
    status: draft.status,
  };
  const description = trimmedOrUndefined(draft.description);
  const videoUrl = trimmedOrUndefined(draft.videoUrl);
  const durationText = draft.videoDurationSeconds.trim();
  if (description !== undefined) payload.description = description;
  if (videoUrl !== undefined) payload.videoUrl = videoUrl;
  if (durationText.length > 0) {
    const parsed = Number(durationText);
    if (Number.isFinite(parsed)) payload.videoDurationSeconds = parsed;
  }
  return payload;
}

export function CourseCurriculumTab({ siteId, courseId }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessonsByChapter, setLessonsByChapter] = useState<Record<string, Lesson[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedChapterIds, setExpandedChapterIds] = useState<string[]>([]);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [expandedLessonChapterId, setExpandedLessonChapterId] = useState<string | null>(null);
  const [chapterDraft, setChapterDraft] = useState<ChapterDraftState>({
    title: "",
    introVideoUrl: "",
    status: "draft",
  });
  const [chapterTitleError, setChapterTitleError] = useState<string | null>(null);
  const [lessonDraftsById, setLessonDraftsById] = useState<Record<string, LessonDraftState>>({});
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterDraft, setNewChapterDraft] = useState<ChapterDraftState>({
    title: "",
    introVideoUrl: "",
    status: "draft",
  });
  const [newChapterTitleError, setNewChapterTitleError] = useState<string | null>(null);
  const [addingLessonForChapter, setAddingLessonForChapter] = useState<string | null>(null);
  const [newLessonDraft, setNewLessonDraft] = useState<LessonDraftState>({
    title: "",
    description: "",
    videoUrl: "",
    videoDurationSeconds: "",
    isFreePreview: false,
    status: "draft",
  });
  const [newLessonTitleError, setNewLessonTitleError] = useState<string | null>(null);
  const [lessonTitleErrorsById, setLessonTitleErrorsById] = useState<Record<string, string | null>>({});
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const hasCourseId = !!courseId;

  const courseBaseUrl = useMemo(() => {
    if (!siteId || !courseId) return null;
    return `/api/hdp/products/${encodeURIComponent(siteId)}/courses/${encodeURIComponent(courseId)}`;
  }, [siteId, courseId]);

  const loadLessonsForChapter = async (chapterId: string): Promise<Lesson[]> => {
    if (!courseBaseUrl) return [];
    const response = await fetch(
      `${courseBaseUrl}/chapters/${encodeURIComponent(chapterId)}/lessons`,
      { credentials: "include" }
    );
    if (!response.ok) {
      throw new Error("Failed to load lessons");
    }
    const data = response.status === 204 ? [] : await response.json();
    return getArrayPayload(data, "lessons").map(normalizeLesson);
  };

  const loadCurriculum = async () => {
    if (!courseBaseUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${courseBaseUrl}/chapters`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load chapters");
      }
      const chapterData = response.status === 204 ? [] : await response.json();
      const loadedChapters = getArrayPayload(chapterData, "chapters").map(normalizeChapter);
      setChapters(loadedChapters);

      const lessonEntries = await Promise.all(
        loadedChapters.map(async (chapter) => [chapter.id, await loadLessonsForChapter(chapter.id)] as const)
      );
      const nextLessons: Record<string, Lesson[]> = {};
      for (const [chapterId, lessons] of lessonEntries) {
        nextLessons[chapterId] = lessons;
      }
      setLessonsByChapter(nextLessons);
    } catch (_error) {
      setError("Failed to load curriculum.");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshChapterLessons = async (chapterId: string) => {
    try {
      const lessons = await loadLessonsForChapter(chapterId);
      setLessonsByChapter((prev) => ({ ...prev, [chapterId]: lessons }));
    } catch (_error) {
      setError("Failed to load lessons.");
    }
  };

  useEffect(() => {
    if (!hasCourseId || !courseBaseUrl) return;
    loadCurriculum();
  }, [hasCourseId, courseBaseUrl]);

  const toggleChapterExpanded = (chapterId: string) => {
    setExpandedChapterIds((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]
    );
  };

  const moveChapter = async (chapterId: string, direction: -1 | 1) => {
    if (!courseBaseUrl) return;
    const index = chapters.findIndex((chapter) => chapter.id === chapterId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= chapters.length) return;

    const next = [...chapters];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`${courseBaseUrl}/chapters/reorder`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapters: next.map((chapter, index) => ({
            id: chapter.id,
            order: index + 1,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to reorder chapters");
      }
      await loadCurriculum();
    } catch (_error) {
      setError("Failed to reorder chapters.");
    } finally {
      setIsSaving(false);
    }
  };

  const moveLesson = async (chapterId: string, lessonId: string, direction: -1 | 1) => {
    if (!courseBaseUrl) return;
    const lessons = lessonsByChapter[chapterId] ?? [];
    const index = lessons.findIndex((lesson) => lesson.id === lessonId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= lessons.length) return;

    const next = [...lessons];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `${courseBaseUrl}/chapters/${encodeURIComponent(chapterId)}/lessons/reorder`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessons: next.map((lesson, index) => ({
              id: lesson.id,
              order: index + 1,
            })),
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to reorder lessons");
      }
      await refreshChapterLessons(chapterId);
    } catch (_error) {
      setError("Failed to reorder lessons.");
    } finally {
      setIsSaving(false);
    }
  };

  const startChapterEdit = (chapter: Chapter) => {
    setEditingChapterId(chapter.id);
    setChapterTitleError(null);
    setChapterDraft({
      title: chapter.title,
      introVideoUrl: chapter.introVideoUrl,
      status: chapter.status,
    });
  };

  const saveChapterEdit = async () => {
    if (!courseBaseUrl || !editingChapterId) return;
    if (chapterDraft.title.trim().length === 0) {
      setChapterTitleError("Title is required");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `${courseBaseUrl}/chapters/${encodeURIComponent(editingChapterId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildChapterPayload(chapterDraft)),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to update chapter");
      }
      setEditingChapterId(null);
      await loadCurriculum();
    } catch (_error) {
      setError("Failed to update chapter.");
    } finally {
      setIsSaving(false);
    }
  };

  const addChapter = async () => {
    if (!courseBaseUrl) return;
    if (newChapterDraft.title.trim().length === 0) {
      setNewChapterTitleError("Title is required");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`${courseBaseUrl}/chapters`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildChapterPayload(newChapterDraft)),
      });
      if (!response.ok) {
        throw new Error("Failed to create chapter");
      }
      setNewChapterDraft({ title: "", introVideoUrl: "", status: "draft" });
      setNewChapterTitleError(null);
      setShowAddChapter(false);
      await loadCurriculum();
    } catch (_error) {
      setError("Failed to create chapter.");
    } finally {
      setIsSaving(false);
    }
  };

  const startLessonEdit = (chapterId: string, lesson: Lesson) => {
    setExpandedLessonId(lesson.id);
    setExpandedLessonChapterId(chapterId);
    setLessonTitleErrorsById((prev) => ({ ...prev, [lesson.id]: null }));
    setLessonDraftsById((prev) => ({
      ...prev,
      [lesson.id]: {
        title: lesson.title,
        description: lesson.description,
        videoUrl: lesson.videoUrl,
        videoDurationSeconds:
          lesson.videoDurationSeconds === null ? "" : String(lesson.videoDurationSeconds),
        isFreePreview: lesson.isFreePreview,
        status: lesson.status,
      },
    }));
  };

  const saveLessonEdit = async (chapterId: string, lessonId: string) => {
    const lessonDraft = lessonDraftsById[lessonId];
    if (!courseBaseUrl || !lessonDraft) return;
    if (lessonDraft.title.trim().length === 0) {
      setLessonTitleErrorsById((prev) => ({ ...prev, [lessonId]: "Title is required" }));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `${courseBaseUrl}/chapters/${encodeURIComponent(chapterId)}/lessons/${encodeURIComponent(lessonId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildLessonPayload(lessonDraft)),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to update lesson");
      }
      setLessonTitleErrorsById((prev) => ({ ...prev, [lessonId]: null }));
      setExpandedLessonId(null);
      setExpandedLessonChapterId(null);
      await refreshChapterLessons(chapterId);
    } catch (_error) {
      setError("Failed to update lesson.");
    } finally {
      setIsSaving(false);
    }
  };

  const addLesson = async (chapterId: string) => {
    if (!courseBaseUrl) return;
    if (newLessonDraft.title.trim().length === 0) {
      setNewLessonTitleError("Title is required");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `${courseBaseUrl}/chapters/${encodeURIComponent(chapterId)}/lessons`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildLessonPayload(newLessonDraft)),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to create lesson");
      }
      setNewLessonDraft({
        title: "",
        description: "",
        videoUrl: "",
        videoDurationSeconds: "",
        isFreePreview: false,
        status: "draft",
      });
      setNewLessonTitleError(null);
      setAddingLessonForChapter(null);
      await refreshChapterLessons(chapterId);
      if (!expandedChapterIds.includes(chapterId)) {
        setExpandedChapterIds((prev) => [...prev, chapterId]);
      }
    } catch (_error) {
      setError("Failed to create lesson.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!courseBaseUrl || !deleteTarget) return;
    setIsSaving(true);
    setError(null);
    try {
      if (deleteTarget.type === "chapter") {
        const response = await fetch(
          `${courseBaseUrl}/chapters/${encodeURIComponent(deleteTarget.chapterId)}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );
        if (!response.ok) {
          throw new Error("Failed to delete chapter");
        }
        await loadCurriculum();
      } else {
        const response = await fetch(
          `${courseBaseUrl}/chapters/${encodeURIComponent(deleteTarget.chapterId)}/lessons/${encodeURIComponent(deleteTarget.lessonId)}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );
        if (!response.ok) {
          throw new Error("Failed to delete lesson");
        }
        await refreshChapterLessons(deleteTarget.chapterId);
      }
      setDeleteTarget(null);
    } catch (_error) {
      setError("Failed to delete item.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasCourseId) {
    return (
      <p className="text-sm text-muted-foreground">
        Save the course details first before adding curriculum.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Curriculum</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSaving}
          onClick={() => setShowAddChapter(true)}
        >
          + Add Chapter
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading curriculum...
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {chapters.map((chapter, chapterIndex) => {
          const isChapterExpanded = expandedChapterIds.includes(chapter.id);
          const lessons = lessonsByChapter[chapter.id] ?? [];
          return (
            <div key={chapter.id} className="rounded-md border">
              <div
                className="flex items-center justify-between gap-3 p-3 cursor-pointer"
                onClick={() => toggleChapterExpanded(chapter.id)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {isChapterExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="truncate font-medium">{chapter.title}</span>
                  <Badge
                    variant="secondary"
                    className={
                      chapter.status === "published"
                        ? "bg-green-100 text-green-800 hover:bg-green-100"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                    }
                  >
                    {chapter.status === "published" ? "Published" : "Draft"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={chapterIndex === 0 || isSaving}
                    onClick={() => moveChapter(chapter.id, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={chapterIndex === chapters.length - 1 || isSaving}
                    onClick={() => moveChapter(chapter.id, 1)}
                  >
                    ↓
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => startChapterEdit(chapter)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      setDeleteTarget({
                        type: "chapter",
                        chapterId: chapter.id,
                        label: chapter.title,
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {editingChapterId === chapter.id ? (
                <div className="space-y-3 border-t p-3">
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input
                      value={chapterDraft.title}
                      onChange={(e) => {
                        setChapterDraft((prev) => ({ ...prev, title: e.target.value }));
                        if (e.target.value.trim().length > 0) {
                          setChapterTitleError(null);
                        }
                      }}
                    />
                    {chapterTitleError ? <p className="text-xs text-destructive">{chapterTitleError}</p> : null}
                  </div>
                  <div className="space-y-1">
                    <Label>Intro Video URL</Label>
                    <Input
                      value={chapterDraft.introVideoUrl}
                      onChange={(e) =>
                        setChapterDraft((prev) => ({ ...prev, introVideoUrl: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select
                      value={chapterDraft.status}
                      onValueChange={(value) =>
                        setChapterDraft((prev) => ({ ...prev, status: value as ItemStatus }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={chapterDraft.title.trim().length === 0 || isSaving}
                      onClick={saveChapterEdit}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingChapterId(null);
                        setChapterTitleError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

              {isChapterExpanded ? (
                <div className="space-y-2 border-t p-3">
                  {lessons.map((lesson, lessonIndex) => {
                    const isLessonExpanded =
                      expandedLessonId === lesson.id && expandedLessonChapterId === chapter.id;
                    const lessonDraft = lessonDraftsById[lesson.id] ?? {
                      title: lesson.title,
                      description: lesson.description,
                      videoUrl: lesson.videoUrl,
                      videoDurationSeconds:
                        lesson.videoDurationSeconds === null ? "" : String(lesson.videoDurationSeconds),
                      isFreePreview: lesson.isFreePreview,
                      status: lesson.status,
                    };
                    return (
                      <div key={lesson.id} className="rounded-md border">
                        <div
                          className="flex items-center justify-between gap-3 p-2 cursor-pointer"
                          onClick={() =>
                            isLessonExpanded
                              ? (setExpandedLessonId(null), setExpandedLessonChapterId(null))
                              : startLessonEdit(chapter.id, lesson)
                          }
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{lesson.title}</span>
                            {lesson.isFreePreview ? (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                Free Preview
                              </Badge>
                            ) : null}
                            <Badge
                              variant="secondary"
                              className={
                                lesson.status === "published"
                                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                              }
                            >
                              {lesson.status === "published" ? "Published" : "Draft"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={lessonIndex === 0 || isSaving}
                              onClick={() => moveLesson(chapter.id, lesson.id, -1)}
                            >
                              ↑
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={lessonIndex === lessons.length - 1 || isSaving}
                              onClick={() => moveLesson(chapter.id, lesson.id, 1)}
                            >
                              ↓
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "lesson",
                                  chapterId: chapter.id,
                                  lessonId: lesson.id,
                                  label: lesson.title,
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        {isLessonExpanded ? (
                          <div className="space-y-3 border-t p-3">
                            <div className="space-y-1">
                              <Label>Title</Label>
                              <Input
                                value={lessonDraft.title}
                                onChange={(e) => {
                                  setLessonDraftsById((prev) => ({
                                    ...prev,
                                    [lesson.id]: { ...lessonDraft, title: e.target.value },
                                  }));
                                  if (e.target.value.trim().length > 0) {
                                    setLessonTitleErrorsById((prev) => ({ ...prev, [lesson.id]: null }));
                                  }
                                }}
                              />
                              {lessonTitleErrorsById[lesson.id] ? (
                                <p className="text-xs text-destructive">{lessonTitleErrorsById[lesson.id]}</p>
                              ) : null}
                            </div>
                            <div className="space-y-1">
                              <Label>Description</Label>
                              <Textarea
                                rows={3}
                                value={lessonDraft.description}
                                onChange={(e) =>
                                  setLessonDraftsById((prev) => ({
                                    ...prev,
                                    [lesson.id]: { ...lessonDraft, description: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Video URL</Label>
                              <Input
                                value={lessonDraft.videoUrl}
                                onChange={(e) =>
                                  setLessonDraftsById((prev) => ({
                                    ...prev,
                                    [lesson.id]: { ...lessonDraft, videoUrl: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Duration (seconds)</Label>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={lessonDraft.videoDurationSeconds}
                                onChange={(e) =>
                                  setLessonDraftsById((prev) => ({
                                    ...prev,
                                    [lesson.id]: { ...lessonDraft, videoDurationSeconds: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-md border px-3 py-2">
                              <Label htmlFor={`lesson-preview-${lesson.id}`}>Free Preview</Label>
                              <Switch
                                id={`lesson-preview-${lesson.id}`}
                                checked={lessonDraft.isFreePreview}
                                onCheckedChange={(checked) =>
                                  setLessonDraftsById((prev) => ({
                                    ...prev,
                                    [lesson.id]: { ...lessonDraft, isFreePreview: checked === true },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Status</Label>
                              <Select
                                value={lessonDraft.status}
                                onValueChange={(value) =>
                                  setLessonDraftsById((prev) => ({
                                    ...prev,
                                    [lesson.id]: { ...lessonDraft, status: value as ItemStatus },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft">Draft</SelectItem>
                                  <SelectItem value="published">Published</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={lessonDraft.title.trim().length === 0 || isSaving}
                                onClick={() => saveLessonEdit(chapter.id, lesson.id)}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setExpandedLessonId(null);
                                  setExpandedLessonChapterId(null);
                                  setLessonTitleErrorsById((prev) => ({ ...prev, [lesson.id]: null }));
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  {addingLessonForChapter === chapter.id ? (
                    <div className="space-y-2 rounded-md border p-3">
                      <div className="space-y-1">
                        <Label>Title</Label>
                        <Input
                          value={newLessonDraft.title}
                          onChange={(e) => {
                            setNewLessonDraft((prev) => ({ ...prev, title: e.target.value }));
                            if (e.target.value.trim().length > 0) {
                              setNewLessonTitleError(null);
                            }
                          }}
                          placeholder="Lesson title"
                        />
                        {newLessonTitleError ? (
                          <p className="text-xs text-destructive">{newLessonTitleError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Label>Description</Label>
                        <Textarea
                          rows={3}
                          value={newLessonDraft.description}
                          onChange={(e) =>
                            setNewLessonDraft((prev) => ({ ...prev, description: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Video URL</Label>
                        <Input
                          value={newLessonDraft.videoUrl}
                          onChange={(e) =>
                            setNewLessonDraft((prev) => ({ ...prev, videoUrl: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Duration (seconds)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={newLessonDraft.videoDurationSeconds}
                          onChange={(e) =>
                            setNewLessonDraft((prev) => ({
                              ...prev,
                              videoDurationSeconds: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <Label htmlFor={`new-lesson-preview-${chapter.id}`}>Free Preview</Label>
                        <Switch
                          id={`new-lesson-preview-${chapter.id}`}
                          checked={newLessonDraft.isFreePreview}
                          onCheckedChange={(checked) =>
                            setNewLessonDraft((prev) => ({ ...prev, isFreePreview: checked === true }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Status</Label>
                        <Select
                          value={newLessonDraft.status}
                          onValueChange={(value) =>
                            setNewLessonDraft((prev) => ({ ...prev, status: value as ItemStatus }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={newLessonDraft.title.trim().length === 0 || isSaving}
                          onClick={() => addLesson(chapter.id)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAddingLessonForChapter(null);
                            setNewLessonDraft({
                              title: "",
                              description: "",
                              videoUrl: "",
                              videoDurationSeconds: "",
                              isFreePreview: false,
                              status: "draft",
                            });
                            setNewLessonTitleError(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAddingLessonForChapter(chapter.id);
                        setNewLessonDraft({
                          title: "",
                          description: "",
                          videoUrl: "",
                          videoDurationSeconds: "",
                          isFreePreview: false,
                          status: "draft",
                        });
                        setNewLessonTitleError(null);
                      }}
                    >
                      + Add Lesson
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {showAddChapter ? (
        <div className="space-y-2 rounded-md border p-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input
              value={newChapterDraft.title}
              onChange={(e) => {
                setNewChapterDraft((prev) => ({ ...prev, title: e.target.value }));
                if (e.target.value.trim().length > 0) {
                  setNewChapterTitleError(null);
                }
              }}
              placeholder="Chapter title"
            />
            {newChapterTitleError ? <p className="text-xs text-destructive">{newChapterTitleError}</p> : null}
          </div>
          <div className="space-y-1">
            <Label>Intro Video URL</Label>
            <Input
              value={newChapterDraft.introVideoUrl}
              onChange={(e) =>
                setNewChapterDraft((prev) => ({ ...prev, introVideoUrl: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={newChapterDraft.status}
              onValueChange={(value) =>
                setNewChapterDraft((prev) => ({ ...prev, status: value as ItemStatus }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={newChapterDraft.title.trim().length === 0 || isSaving}
              onClick={addChapter}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAddChapter(false);
                setNewChapterDraft({ title: "", introVideoUrl: "", status: "draft" });
                setNewChapterTitleError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.label}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {isSaving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
