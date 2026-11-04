/**
 * StatsDashboard — an overview of the library: totals, storage, projects per
 * folder and per tag, import activity, and recently/most opened projects.
 * Bars are clickable and jump to the folder or tag they represent.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, ButtonBase, LinearProgress, Paper, Typography } from '@mui/material';
import { useLibrary } from '../../state/LibraryContext.jsx';
import { useFolderIndex } from '../../hooks/useVisibleProjects.js';
import { VIEWS } from '../../state/constants.js';
import { formatBytes, timeAgo } from '../../utils/format.js';
import { HBarChart, ColumnChart } from './Charts.jsx';
import Thumbnail from '../common/Thumbnail.jsx';

function Panel({ title, children, sx }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 0, ...sx }}>
      {title && <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>{title}</Typography>}
      {children}
    </Paper>
  );
}

function Stat({ label, value, detail }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 600, lineHeight: 1.25, mt: 0.5 }}>{value}</Typography>
      {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
    </Paper>
  );
}

function MiniList({ items, meta, emptyText, onOpen }) {
  if (!items.length) return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {items.map((p) => (
        <ButtonBase key={p.id} onClick={() => onOpen(p)} sx={{ display: 'flex', gap: 1.25, alignItems: 'center', justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1, p: 0.5, '&:hover': { bgcolor: 'action.hover' } }}>
          <Box sx={{ width: 56, flexShrink: 0, borderRadius: 1, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
            <Thumbnail project={p} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>{p.name}</Typography>
            <Typography variant="caption" color="text.secondary">{meta(p)}</Typography>
          </Box>
        </ButtonBase>
      ))}
    </Box>
  );
}

export default function StatsDashboard() {
  const { state, actions } = useLibrary();
  const folderIndex = useFolderIndex();
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    navigator.storage?.estimate?.().then(setQuota).catch(() => {});
  }, [state.projects.length]);

  const stats = useMemo(() => {
    const { projects, tags } = state;
    const totalSize = projects.reduce((s, p) => s + (p.size || 0), 0);

    // Projects per top-level folder, counting everything nested below it.
    const topOf = (folderId) => folderIndex.pathOf(folderId)[0]?.id || null;
    const perFolder = new Map();
    projects.forEach((p) => {
      const k = topOf(p.folderId);
      perFolder.set(k, (perFolder.get(k) || 0) + 1);
    });
    const folderData = [...perFolder.entries()]
      .map(([id, value]) => ({ key: id || 'unfiled', id, label: id ? folderIndex.byId.get(id)?.name || 'Unknown' : 'Unfiled', value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const tagColor = new Map(tags.map((t) => [t.name, t.color]));
    const perTag = new Map();
    projects.forEach((p) => (p.tags || []).forEach((t) => perTag.set(t, (perTag.get(t) || 0) + 1)));
    const tagData = [...perTag.entries()]
      .map(([name, value]) => ({ key: name, label: name, value, color: tagColor.get(name) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    // Imports per day, last 30 days.
    const day = 86_400_000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = today.getTime() - 29 * day;
    const buckets = Array.from({ length: 30 }, (_, i) => ({
      label: new Date(start + i * day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: 0,
    }));
    projects.forEach((p) => {
      const i = Math.floor((p.importedAt - start) / day);
      if (i >= 0 && i < 30) buckets[i].value++;
    });

    return {
      total: projects.length,
      totalSize,
      favorites: projects.filter((p) => p.favorite).length,
      archived: projects.filter((p) => p.archived).length,
      opens: projects.reduce((s, p) => s + (p.openCount || 0), 0),
      folderData,
      tagData,
      buckets,
      recentImports: [...projects].sort((a, b) => b.importedAt - a.importedAt).slice(0, 6),
      recentOpened: projects.filter((p) => p.lastOpenedAt).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 6),
      mostOpened: projects.filter((p) => p.openCount).sort((a, b) => b.openCount - a.openCount).slice(0, 6),
    };
  }, [state, folderIndex]);

  const open = (p) => {
    actions.setActive(p.id);
    actions.clickProject(p.id);
  };

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>Library statistics</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1.5, mb: 1.5 }}>
        <Stat label="Projects" value={stats.total.toLocaleString()} detail={`${stats.archived} archived, ${stats.favorites} favorites`} />
        <Stat label="Folders" value={state.folders.length} />
        <Stat label="Tags" value={state.tags.length} />
        <Stat label="Times run" value={stats.opens.toLocaleString()} />
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">Storage used</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 600, lineHeight: 1.25, mt: 0.5 }}>{formatBytes(stats.totalSize)}</Typography>
          {quota?.quota ? (
            <>
              <LinearProgress variant="determinate" value={Math.min(100, (quota.usage / quota.quota) * 100)} sx={{ my: 0.75, borderRadius: 1 }} />
              <Typography variant="caption" color="text.secondary">
                Browser storage: {formatBytes(quota.usage)} of {formatBytes(quota.quota)} available
              </Typography>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">.sb3 files in this library</Typography>
          )}
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
        <Panel title="Projects per folder">
          <HBarChart
            data={stats.folderData}
            emptyText="Import projects to see how they are spread across folders."
            onSelect={(d) => actions.navigate(d.id ? { type: VIEWS.folder, folderId: d.id } : { type: VIEWS.unfiled })}
          />
        </Panel>
        <Panel title="Projects per tag">
          <HBarChart
            data={stats.tagData}
            emptyText="No tags used yet."
            onSelect={(d) => {
              actions.setTagFilter([d.label]);
              actions.navigate({ type: VIEWS.all });
            }}
          />
        </Panel>
      </Box>

      <Panel title="Imports in the last 30 days" sx={{ mb: 1.5 }}>
        <ColumnChart data={stats.buckets} />
      </Panel>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
        <Panel title="Recent imports">
          <MiniList items={stats.recentImports} meta={(p) => `Imported ${timeAgo(p.importedAt)}`} emptyText="Nothing imported yet." onOpen={open} />
        </Panel>
        <Panel title="Recently opened">
          <MiniList items={stats.recentOpened} meta={(p) => `Opened ${timeAgo(p.lastOpenedAt)}`} emptyText="Run a project to see it here." onOpen={open} />
        </Panel>
        <Panel title="Most opened">
          <MiniList items={stats.mostOpened} meta={(p) => `Run ${p.openCount} time${p.openCount === 1 ? '' : 's'}`} emptyText="No projects run yet." onOpen={open} />
        </Panel>
      </Box>
    </Box>
  );
}
