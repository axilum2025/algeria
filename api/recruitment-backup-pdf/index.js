const PDFDocument = require('pdfkit');

module.exports = async function (context, req) {
  const setCors = () => {
    context.res = context.res || {};
    context.res.headers = Object.assign({}, context.res.headers, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
  };

  if (req.method === 'OPTIONS') {
    setCors();
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    setCors();

    const body = req.body || {};
    const exportDate = body.exportDate || new Date().toISOString();
    const jobs = Array.isArray(body.jobs) ? body.jobs : [];
    const candidates = Array.isArray(body.candidates) ? body.candidates : [];
    const stats = body.statistics || {};

    const buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, bufferPages: true, autoFirstPage: false });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.addPage();

      doc.font('Helvetica-Bold').fontSize(18).fillColor('#064e3b').text('RECRUTEMENT — SAUVEGARDE', { align: 'center' });
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).fillColor('gray').text(`Généré: ${new Date(exportDate).toLocaleString('fr-FR')}`, { align: 'center' });
      doc.moveDown(1);
      doc.fillColor('black');

      doc.font('Helvetica-Bold').fontSize(13).text('Résumé');
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(11);
      doc.text(`Offres totales: ${Number(stats.totalJobs ?? jobs.length)}`);
      doc.text(`Offres actives: ${Number(stats.activeJobs ?? jobs.filter(j => String(j?.status ?? 'active').toLowerCase() === 'active').length)}`);
      doc.text(`CV / candidats: ${Number(stats.totalCandidates ?? candidates.length)}`);
      doc.text(`Shortlist: ${Number(stats.shortlist ?? candidates.filter(c => c?.shortlisted === true).length)}`);
      doc.text(`Score moyen: ${Number(stats.avgScore ?? (candidates.length ? Math.round(candidates.reduce((s, c) => s + (Number(c?.matchScore) || 0), 0) / candidates.length) : 0))} / 100`);

      doc.moveDown(1.2);
      doc.font('Helvetica-Bold').fontSize(13).text('Offres');
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10);

      if (!jobs.length) {
        doc.fillColor('gray').text('Aucune offre.').fillColor('black');
      } else {
        jobs.slice(0, 80).forEach((j, idx) => {
          const status = j?.status || 'active';
          const line = `${idx + 1}. ${j?.title || 'Sans titre'} — ${j?.location || 'N/A'} — ${j?.department || 'N/A'} — statut: ${status}`;
          doc.text(line);
        });
        if (jobs.length > 80) {
          doc.fillColor('gray').text(`… ${jobs.length - 80} offres supplémentaires non affichées`).fillColor('black');
        }
      }

      doc.moveDown(1.2);
      doc.font('Helvetica-Bold').fontSize(13).text('Candidats');
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10);

      if (!candidates.length) {
        doc.fillColor('gray').text('Aucun candidat.').fillColor('black');
      } else {
        const jobById = new Map(jobs.map(j => [String(j.id), j]));
        candidates.slice(0, 120).forEach((c, idx) => {
          const job = jobById.get(String(c?.jobId || ''));
          const jobTitle = job?.title || c?.jobTitle || 'Offre inconnue';
          const score = Number(c?.matchScore) || 0;
          const star = c?.shortlisted === true ? '⭐ ' : '';
          const line = `${idx + 1}. ${star}${c?.name || 'Sans nom'} — ${c?.email || 'N/A'} — ${jobTitle} — score: ${score}/100`;
          doc.text(line);
        });
        if (candidates.length > 120) {
          doc.fillColor('gray').text(`… ${candidates.length - 120} candidats supplémentaires non affichés`).fillColor('black');
        }
      }

      doc.end();
    });

    const day = new Date(exportDate).toISOString().slice(0, 10);
    const fileName = `recrutement-backup-${day}.pdf`;

    context.res.status = 200;
    context.res.headers = Object.assign({}, context.res.headers, {
      'Content-Type': 'application/json'
    });
    context.res.body = {
      success: true,
      fileName,
      mimeType: 'application/pdf',
      contentBase64: buffer.toString('base64')
    };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers = Object.assign({}, context.res.headers, {
      'Content-Type': 'application/json'
    });
    context.res.body = { success: false, error: err.message || String(err) };
  }
};
