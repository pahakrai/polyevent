'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  uploadDocument,
  listDocuments,
  deleteDocument,
  type DocumentRecord,
} from '@/lib/knowledge-api';

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const loadDocs = useCallback(async () => {
    try {
      const result = await listDocuments();
      setDocs(result);
    } catch {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setError('File and title are required');
      return;
    }
    setUploading(true);
    setError('');
    try {
      await uploadDocument(file, title);
      setTitle('');
      setFile(null);
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError('Failed to delete document');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground">
            Upload documents for AI-powered Q&A
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/knowledge/chat')}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Open Chat
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Upload form */}
      <div className="mb-8 rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold">Upload Document</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Company Refund Policy"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted'
            }`}
          >
            {file ? (
              <div className="text-center">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="mt-2 text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Drag and drop a file here, or
                </p>
                <label className="mt-2 cursor-pointer rounded-md bg-muted px-4 py-2 text-sm hover:bg-muted/80">
                  Browse files
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                    }}
                  />
                </label>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Supported: PDF, DOCX, TXT, Markdown (max 10MB)
          </p>

          <button
            onClick={handleUpload}
            disabled={uploading || !file || !title.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload & Process'}
          </button>
        </div>
      </div>

      {/* Document list */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold">
          Documents ({docs.length})
        </h3>

        {loading ? (
          <div className="h-32 animate-pulse rounded-md bg-muted" />
        ) : docs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No documents yet. Upload one to get started.
          </p>
        ) : (
          <div className="divide-y">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString()} &middot;{' '}
                    {doc.content_type}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
