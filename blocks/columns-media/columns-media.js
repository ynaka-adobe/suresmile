/**
 * columns-media: a media column (logo, photo or stat graphic) beside a text column.
 * One row, two cells: media | text (either order). Optional heading in the text cell.
 */
export default function decorate(block) {
  const firstRow = block.firstElementChild;
  const cols = firstRow ? [...firstRow.children] : [];
  block.classList.add(`columns-media-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    row.classList.add('columns-media-row');
    [...row.children].forEach((col, i) => {
      const pic = col.querySelector('picture');
      const onlyMedia = pic && !col.textContent.trim();
      col.classList.add(onlyMedia ? 'columns-media-media' : 'columns-media-text');
      if (onlyMedia && i > 0) row.classList.add('columns-media-media-last');
    });
  });
}
