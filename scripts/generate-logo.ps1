Add-Type -AssemblyName System.Drawing

function Create-AfaMark([int]$width, [int]$height, [string]$outputPath) {
    $bmp = [System.Drawing.Bitmap]::new($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Brand colors
    $brandRed = [System.Drawing.ColorTranslator]::FromHtml('#C8102E')
    $darkRed = [System.Drawing.ColorTranslator]::FromHtml('#B30B24')
    $boneWhite = [System.Drawing.ColorTranslator]::FromHtml('#FDFBF7')
    $goldStone = [System.Drawing.ColorTranslator]::FromHtml('#C9BBA2')

    # Gradient background
    $rect = [System.Drawing.RectangleF]::new(0, 0, [float]$width, [float]$height)
    $gradBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $brandRed, $darkRed, 45.0)
    $g.FillRectangle($gradBrush, $rect)
    $gradBrush.Dispose()

    # Outer architectural frame / border inset
    $inset = [float]($width * 0.07)
    $framePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(50, 255, 255, 255), [float]($width * 0.015))
    $g.DrawRectangle($framePen, $inset, $inset, [float]($width - 2 * $inset), [float]($height - 2 * $inset))
    $framePen.Dispose()

    $inset2 = [float]($width * 0.09)
    $framePen2 = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(70, 201, 187, 162), [float]($width * 0.008))
    $g.DrawRectangle($framePen2, $inset2, $inset2, [float]($width - 2 * $inset2), [float]($height - 2 * $inset2))
    $framePen2.Dispose()

    # Architectural apex / pediment chevron at top
    $topY = [float]($height * 0.19)
    $apexY = [float]($height * 0.11)
    $midX = [float]($width * 0.5)
    $leftX = [float]($width * 0.22)
    $rightX = [float]($width * 0.78)

    $pen = [System.Drawing.Pen]::new($boneWhite, [float]($width * 0.03))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $p1 = [System.Drawing.PointF]::new($leftX, $topY)
    $p2 = [System.Drawing.PointF]::new($midX, $apexY)
    $p3 = [System.Drawing.PointF]::new($rightX, $topY)
    $g.DrawLines($pen, [System.Drawing.PointF[]]@($p1, $p2, $p3))
    $pen.Dispose()

    # Sub-beam under apex
    $subBeamPen = [System.Drawing.Pen]::new($goldStone, [float]($width * 0.012))
    $g.DrawLine($subBeamPen, [float]($leftX + $width * 0.04), [float]($topY + $height * 0.035), [float]($rightX - $width * 0.04), [float]($topY + $height * 0.035))
    $subBeamPen.Dispose()

    # Bold Monogram AFA in center
    $fontSize = [float]($width * 0.26)
    $fontFamily = [System.Drawing.FontFamily]::GenericSansSerif
    $font = [System.Drawing.Font]::new($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

    $textBrush = [System.Drawing.SolidBrush]::new($boneWhite)
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textRect = [System.Drawing.RectangleF]::new(0, [float]($height * 0.26), [float]$width, [float]($height * 0.38))
    $g.DrawString("AFA", $font, $textBrush, $textRect, $format)
    $font.Dispose()

    # Divider bar
    $divY = [float]($height * 0.66)
    $divPen = [System.Drawing.Pen]::new($goldStone, [float]($width * 0.015))
    $g.DrawLine($divPen, [float]($width * 0.18), $divY, [float]($width * 0.82), $divY)
    $divPen.Dispose()

    # Label: AMERICAN FINANCIAL
    $smallFontSize1 = [float]($width * 0.052)
    $font1 = [System.Drawing.Font]::new($fontFamily, $smallFontSize1, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textRect1 = [System.Drawing.RectangleF]::new(0, [float]($height * 0.70), [float]$width, [float]($height * 0.10))
    $g.DrawString("AMERICAN FINANCIAL", $font1, $textBrush, $textRect1, $format)
    $font1.Dispose()

    # Sub-label: ASSOCIATES
    $smallFontSize2 = [float]($width * 0.044)
    $font2 = [System.Drawing.Font]::new($fontFamily, $smallFontSize2, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $goldBrush = [System.Drawing.SolidBrush]::new($goldStone)
    $textRect2 = [System.Drawing.RectangleF]::new(0, [float]($height * 0.79), [float]$width, [float]($height * 0.09))
    $g.DrawString("ASSOCIATES", $font2, $goldBrush, $textRect2, $format)
    $font2.Dispose()

    # Tag: US CONSTRUCTION AGENCY
    $smallFontSize3 = [float]($width * 0.034)
    $font3 = [System.Drawing.Font]::new($fontFamily, $smallFontSize3, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $tagRect = [System.Drawing.RectangleF]::new(0, [float]($height * 0.88), [float]$width, [float]($height * 0.08))
    $g.DrawString("US CONSTRUCTION AGENCY", $font3, $goldBrush, $tagRect, $format)
    $font3.Dispose()

    $textBrush.Dispose()
    $goldBrush.Dispose()
    $format.Dispose()
    $g.Dispose()

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated $outputPath ($width x $height)"
}

Create-AfaMark 512 512 "public\im\logo.png"
Create-AfaMark 512 512 "public\im\logo-mark.png"
Create-AfaMark 192 192 "public\im\icon-192.png"
Create-AfaMark 512 512 "public\im\icon-512.png"
Create-AfaMark 180 180 "public\im\apple-touch-icon.png"
Create-AfaMark 64 64 "public\im\favicon.png"
