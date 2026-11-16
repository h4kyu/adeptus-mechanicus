# Two-piece Mylar layout

Start the editor with `node stencil-app/server.mjs` and open http://127.0.0.1:8765. The two-piece layout is optional for each project.

## Use it

1. Open **Stencil & bridges → Finished size** and set the artwork's physical long edge.
2. Choose **Mylar pieces per intensity → Two overlapping sheets**. The source image and artwork scale are preserved.
3. Choose a vertical or horizontal join, stock orientation, and working-area overlap. **Suggest join through unbleached areas** searches feasible bands across every assigned intensity. Move **Join position** to adjust it manually.
4. Select **Piece A** or **Piece B** outside Finished size. **Fit both pieces** shows the assembly. Orange bands identify the uncut joining stock borders when those borders are retained.
5. Check and bridge each physical piece. New bridges belong to the selected piece and intensity. Existing shared bridges remain editable and are flagged after layout changes. Bridge undo stays separate from assignment history.
6. Browse the read-only Mylar A/B previews and combined bleach view. The combined view includes blocked stock-border bands when stock is untrimmed.
7. Export the selected intensity and piece. Each SVG retains the full working-area dimensions and contains only opening contours. The review gives local cut bounds and A/B assembly offsets; filenames identify the piece. Repeat for the other piece/intensities. If a piece needs no openings, use an uncut piece for shielding; no SVG is needed.

Each intensity uses its own A/B pair: three intensities can require six physical Mylar pieces. Assemble each pair before spraying. This implementation does not support spraying two overlapping pieces separately; duplicated openings could receive more than one application that way.

## Joining full stock versus trimming

The **24 × 12 inch stock is larger than its 590 × 290 mm working area**. With the working area centered, the unused stock extends 9.8 mm beyond each long-axis end and 7.4 mm beyond each short-axis side. Overlapping working areas alone does not remove these uncut borders. A border can cover the neighboring piece's openings.

Full stock is the default. Exports are blocked wherever the neighboring uncut border would obstruct the selected piece's final vector openings. Move the join into retained material, or explicitly select **Manually trim the joining stock edges**.

That option requires centering and marking the working area on each actual sheet, then manually trimming only the two facing stock edges to those boundaries before alignment and taping. Keep all other stock edges for shielding. The SVG never cuts the trim line or an outer stock rectangle. Follow the assembly working-origin offsets consistently across intensities; they refer to working areas, not raw stock edges or cropped cut bounds. Keep tape clear of every opening.

Opening geometry in the usable overlap is duplicated on both SVGs. This prevents one piece from covering the other's openings after the joining edges have been handled correctly. It does not guarantee an invisible seam, especially where a join crosses an opening.

## Join suggestion

The worker makes one scan of effective assignments, including lasso exceptions. Row/column prefix sums let it compare straight bands cheaply. It scores positive-treatment pixels most heavily, penalizes unassigned pixels, and prefers a balanced join on ties. It searches both directions and stock orientations within the two-sheet fit limits. The band includes overlap, 2 mm clearance, and uncut joining borders when preserving full stock.

This is a straight-band heuristic, not an arbitrary curved seam finder. It uses assignments for the suggestion; export separately checks actual smoothed, bridge-subtracted vector openings. Changing assignments, smoothing, sizing or layout requires reviewing the join again.

Bonsai fits at a 15-inch long edge, but the examined horizontal join still crosses openings. Browser checks on Intensity 3 found a 841.3 mm² overlap opening area and showed that an uncut neighboring stock border would block 477.1 mm² on Piece B. The app blocks that export with full stock and supplies explicit manual-trimming instructions when trimming is selected. These are measurements of the trial snapshot, not a claim that this is the only or best physical assembly.

## Verification and limits

37 focused checks pass across the new layout tests and existing stencil/export/preview/automatic-bridge tests. They cover fit constraints, shared joins, safe and unavoidable bands, unchanged scale, reconstructed A/B opening coverage, millimeter placement, per-piece bridges, physical-edge connectivity, uncut-border obstruction, empty pieces, validation and project persistence. The full suite was not run.

Browser checks covered Bonsai sizing, automatic suggestion, switching A/B, actual A/B SVG generation, border-blocked export, the trimming option, and a Piece B bridge drawn outside the artwork that saved with `piece: 1` and undid correctly. A saved/reopened layout retained its settings. Source pixels, segmentation, region/pixel assignments remain unchanged by layout edits.

Native-scale connectivity is a review aid. It uses working-area bounds and conservatively omits retained stock beyond them; it is not a material-strength certification. A 12-million-pixel working-area memory limit can disable native connectivity at small physical sizes/high source resolutions. Vector export still runs with an explicit missing-connectivity warning and keeps vector island checks.

Cricut import, working-origin placement on real stock, trimming/tape procedure, seam appearance and test cuts remain unverified. Curved joins, registration cuts, more than two pieces, separate sequential spraying and batch export are deferred.
